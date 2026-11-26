"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { CHANNEL_LABELS, deliveryNumber } from "@/lib/deliveries";
import { type FormState, firstError, optionalText } from "@/lib/forms";
import { parseDateKey, riyadhDateTime } from "@/lib/time";
import { canSeeTx } from "@/lib/transactions";

const schema = z.object({
  transactionId: z.string().min(1),
  deliveredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "يرجى إدخال تاريخ ووقت التسليم"),
  channel: z.enum(["HAND", "WHATSAPP", "EMAIL", "COURIER", "PLATFORM", "OTHER"], { message: "يرجى اختيار طريقة التسليم" }),
  recipientName: z.string().trim().min(3, "يرجى إدخال اسم المستلم"),
  recipientIdNo: optionalText.refine((v) => v === null || /^[12]\d{9}$/.test(v), {
    message: "يجب أن تتكون هوية المستلم من 10 أرقام وتبدأ بـ 1 أو 2",
  }),
  recipientPhone: optionalText.refine((v) => v === null || /^[\d+\s-]{9,16}$/.test(v), { message: "رقم جوال المستلم غير صحيح" }),
  items: optionalText.refine((v) => v === null || v.length <= 2000, { message: "البنود المسلَّمة طويلة جداً" }),
  note: optionalText.refine((v) => v === null || v.length <= 1000, { message: "الرسالة طويلة جداً (1000 حرف كحد أقصى)" }),
});

const paths = (txId: string) => {
  revalidatePath(`/requests/all/${txId}`);
  revalidatePath("/requests/deliverables");
  revalidatePath("/");
};

// تسجيل تسليم مخرجات (مستندات مرفوعة و/أو أصول ورقية) للعميل
export async function recordDelivery(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSection("requests", "EDIT");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { deliveredAt: at, transactionId, ...data } = parsed.data;

  const tx = await db.transaction.findUnique({ where: { id: transactionId }, select: { id: true, confidential: true, assigneeId: true, stage: { select: { kind: true } } } });
  if (!tx || !canSeeTx(user, tx)) return { error: "المعاملة غير موجودة" };
  // إغلاق المعاملة بأول مرحلة مكتملة (مثل: مكتملة ومسلّمة) عند اختيار ذلك
  const doneStage = formData.get("complete") === "on" && tx.stage.kind !== "DONE"
    ? await db.stage.findFirst({ where: { active: true, kind: "DONE" }, orderBy: { order: "asc" } })
    : null;

  const docIds = formData.getAll("documentIds").map(String).filter(Boolean);
  const docs = docIds.length
    ? await db.document.findMany({ where: { id: { in: docIds }, transactionId }, select: { id: true } })
    : [];
  if (docs.length !== docIds.length) return { error: "بعض المستندات المختارة لا تتبع هذه المعاملة" };
  if (docs.length === 0 && !data.items) return { error: "يرجى اختيار مستند واحد على الأقل أو كتابة البنود المسلَّمة" };

  const deliveredAt = riyadhDateTime(parseDateKey(at.slice(0, 10)), at.slice(11, 16));
  if (Number.isNaN(deliveredAt.getTime())) return { error: "تاريخ التسليم غير صحيح" };
  if (deliveredAt.getTime() > Date.now() + 10 * 60000) return { error: "لا يمكن أن يكون تاريخ التسليم في المستقبل" };

  await db.$transaction(async (t) => {
    const d = await t.delivery.create({
      data: {
        ...data, transactionId, deliveredAt, deliveredById: user.id,
        documents: { connect: docs.map((x) => ({ id: x.id })) },
      },
    });
    if (doneStage) await t.transaction.update({ where: { id: transactionId }, data: { stageId: doneStage.id } });
    await t.transactionEvent.create({
      data: {
        transactionId, userId: user.id, stageId: doneStage?.id ?? null, type: "DELIVERY",
        note: `تم تسليم المخرجات للعميل (${deliveryNumber(d.number)}) — ${CHANNEL_LABELS[data.channel]} — المستلم: ${data.recipientName}`
          + (data.note ? `\nرسالة للعميل: ${data.note}` : ""),
      },
    });
  });
  paths(transactionId);
  return { success: doneStage ? `تم تسجيل التسليم ونقل المعاملة إلى «${doneStage.name}»` : "تم تسجيل التسليم" };
}

// حذف سجل تسليم أُدخل بالخطأ (إدارة كاملة) مع إثبات ذلك في سجل المتابعة
export async function deleteDelivery(formData: FormData) {
  const user = await requireSection("requests", "MANAGE");
  const d = await db.delivery.findUnique({ where: { id: String(formData.get("id")) } });
  if (!d) return;
  await db.$transaction([
    db.delivery.delete({ where: { id: d.id } }),
    db.transactionEvent.create({
      data: { transactionId: d.transactionId, userId: user.id, note: `تم حذف سجل التسليم ${deliveryNumber(d.number)}` },
    }),
  ]);
  paths(d.transactionId);
}
