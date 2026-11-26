"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalDate, optionalMoney, optionalText } from "@/lib/forms";
import { awaitingAcceptance, canSeeTx, pickAssignee } from "@/lib/transactions";

const txSchema = z.object({
  companyId: z.string().min(1, "يرجى اختيار الشركة"),
  title: z.string().trim().min(3, "يرجى إدخال عنوان واضح للمعاملة"),
  description: optionalText,
  serviceTypeId: optionalText,
  govEntityId: optionalText,
  platformRef: optionalText,
  fee: optionalMoney,
  govFees: optionalMoney,
  dueDate: optionalDate,
  priority: z.enum(["NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  confidential: z.string().optional().transform((v) => v === "on"),
});

export async function createTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSection("requests", "EDIT");
  const parsed = txSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const firstStage = await db.stage.findFirst({ where: { active: true, kind: "OPEN" }, orderBy: { order: "asc" } });
  if (!firstStage) return { error: "لا توجد مراحل معرّفة — يرجى إضافة المراحل من الإعدادات أولاً" };

  // المسؤول: موظف محدد، أو توزيع تلقائي، أو بدون مسؤول
  const choice = String(formData.get("assigneeId") ?? "auto");
  let assignee: { id: string; name: string } | null = null;
  let auto = false;
  if (choice === "auto") {
    assignee = await pickAssignee(db, parsed.data.serviceTypeId);
    auto = !!assignee;
  } else if (choice) {
    assignee = await db.user.findFirst({ where: { id: choice, active: true }, select: { id: true, name: true } });
    if (!assignee) return { error: "الموظف المختار غير موجود" };
  }

  const tx = await db.transaction.create({
    data: {
      ...parsed.data,
      assigneeId: assignee?.id ?? null,
      stageId: firstStage.id,
      createdById: user.id,
      events: {
        create: [
          { stageId: firstStage.id, note: "تم إنشاء المعاملة", userId: user.id },
          ...(assignee ? [{
            type: "ASSIGN" as const, userId: user.id, targetUserId: assignee.id, createdAt: new Date(Date.now() + 1000), // بعد حدث الإنشاء في السجل
            note: auto ? `أُسندت تلقائياً إلى ${assignee.name} (الأقل انشغالاً)` : `أُسندت إلى ${assignee.name}`,
          }] : []),
        ],
      },
    },
  });
  redirect(`/requests/all/${tx.id}`);
}

export async function updateTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSection("requests", "EDIT");
  const id = String(formData.get("id"));
  const parsed = txSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const tx = await db.transaction.findUnique({ where: { id }, select: { confidential: true, assigneeId: true } });
  if (!tx || !canSeeTx(user, tx)) return { error: "المعاملة غير موجودة" };
  // الموعد المستهدف يتغيّر بطلب تأجيل، إلا لصاحب الإدارة الكاملة
  const { dueDate, ...data } = parsed.data;
  await db.transaction.update({ where: { id }, data: can(user, "requests", "MANAGE") ? { ...data, dueDate } : data });
  revalidatePath(`/requests/all/${id}`);
  return { success: "تم حفظ التعديلات" };
}

// تغيير المرحلة و/أو إضافة تعليق (داخلي أو خارجي للعميل) في سجل المتابعة
export async function addTransactionEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSection("requests", "EDIT");
  const id = String(formData.get("id"));
  const stageId = String(formData.get("stageId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const external = formData.get("external") === "on";

  const tx = await db.transaction.findUnique({ where: { id }, include: { stage: { select: { kind: true } } } });
  if (!tx || !canSeeTx(user, tx)) return { error: "المعاملة غير موجودة" };
  const stageChanged = stageId !== "" && stageId !== tx.stageId;
  if (!stageChanged && !note) return { error: "يرجى تغيير المرحلة أو كتابة تعليق" };
  if (external && !note) return { error: "يرجى كتابة نص التعليق الموجّه للعميل" };
  if (stageChanged && awaitingAcceptance(tx)) {
    return { error: "لا يمكن تغيير المرحلة قبل أن يستلم الموظف المسؤول المعاملة بتعهد" };
  }
  if (stageChanged && !(await db.stage.findUnique({ where: { id: stageId } }))) return { error: "مرحلة غير صحيحة" };

  await db.$transaction([
    ...(stageChanged ? [db.transaction.update({ where: { id }, data: { stageId } })] : []),
    db.transactionEvent.create({
      data: { transactionId: id, stageId: stageChanged ? stageId : null, note: note || null, external, userId: user.id },
    }),
  ]);
  revalidatePath(`/requests/all/${id}`);
  return { success: stageChanged ? "تم تحديث المرحلة" : external ? "تمت إضافة التعليق الخارجي" : "تمت إضافة التعليق" };
}
