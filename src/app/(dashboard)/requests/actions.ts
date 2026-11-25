"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalDate, optionalMoney, optionalText } from "@/lib/forms";

const txSchema = z.object({
  companyId: z.string().min(1, "اختار الشركة"),
  title: z.string().trim().min(3, "اكتب عنوان واضح للمعاملة"),
  description: optionalText,
  serviceTypeId: optionalText,
  govEntityId: optionalText,
  assigneeId: optionalText,
  platformRef: optionalText,
  fee: optionalMoney,
  govFees: optionalMoney,
  dueDate: optionalDate,
});

export async function createTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSection("requests");
  const parsed = txSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const firstStage = await db.stage.findFirst({ where: { active: true, kind: "OPEN" }, orderBy: { order: "asc" } });
  if (!firstStage) return { error: "مفيش مراحل معرّفة — ضيف مراحل من الإعدادات الأول" };

  const tx = await db.transaction.create({
    data: {
      ...parsed.data,
      stageId: firstStage.id,
      createdById: user.id,
      events: { create: { stageId: firstStage.id, note: "تم إنشاء المعاملة", userId: user.id } },
    },
  });
  redirect(`/requests/all/${tx.id}`);
}

export async function updateTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("requests");
  const id = String(formData.get("id"));
  const parsed = txSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await db.transaction.update({ where: { id }, data: parsed.data });
  revalidatePath(`/requests/all/${id}`);
  return { success: "تم حفظ التعديلات" };
}

// تغيير المرحلة و/أو إضافة ملاحظة في سجل المتابعة
export async function addTransactionEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSection("requests");
  const id = String(formData.get("id"));
  const stageId = String(formData.get("stageId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const tx = await db.transaction.findUnique({ where: { id } });
  if (!tx) return { error: "المعاملة مش موجودة" };
  const stageChanged = stageId !== "" && stageId !== tx.stageId;
  if (!stageChanged && !note) return { error: "غيّر المرحلة أو اكتب ملاحظة" };
  if (stageChanged && !(await db.stage.findUnique({ where: { id: stageId } }))) return { error: "مرحلة غير صحيحة" };

  await db.$transaction([
    ...(stageChanged ? [db.transaction.update({ where: { id }, data: { stageId } })] : []),
    db.transactionEvent.create({
      data: { transactionId: id, stageId: stageChanged ? stageId : null, note: note || null, userId: user.id },
    }),
  ]);
  revalidatePath(`/requests/all/${id}`);
  return { success: stageChanged ? "تم تحديث المرحلة" : "تم إضافة الملاحظة" };
}
