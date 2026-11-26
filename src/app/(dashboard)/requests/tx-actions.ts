"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, txNumber } from "@/lib/format";
import { type FormState, firstError, optionalText } from "@/lib/forms";
import { parseDateKey, riyadhToday } from "@/lib/time";
import { awaitingAcceptance, canAssign, canSeeTx, isManagerOf, pledgeText } from "@/lib/transactions";

const dateKeySchema = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg).transform((v) => parseDateKey(v));

async function loadTx(id: string) {
  return db.transaction.findUnique({
    where: { id },
    include: { stage: { select: { kind: true } }, assignee: { select: { id: true, name: true } } },
  });
}
const refresh = (id: string) => {
  revalidatePath(`/requests/all/${id}`);
  revalidatePath("/");
};

// إسناد المعاملة لموظف (أو تحويلها لزميل) — يتطلب استلاماً جديداً بتعهد
export async function assignTransaction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection("requests", "EDIT");
  const tx = await loadTx(String(fd.get("id")));
  if (!tx || !canSeeTx(user, tx)) return { error: "المعاملة غير موجودة" };
  if (!canAssign(user, tx)) return { error: "ليست لديك صلاحية إسناد هذه المعاملة" };
  if (tx.stage.kind !== "OPEN") return { error: "لا يمكن إسناد معاملة مكتملة أو ملغاة" };
  const to = await db.user.findFirst({ where: { id: String(fd.get("assigneeId") ?? ""), active: true }, select: { id: true, name: true } });
  if (!to) return { error: "يرجى اختيار الموظف" };
  if (to.id === tx.assigneeId) return { error: "المعاملة مسندة لهذا الموظف بالفعل" };
  const note = String(fd.get("note") ?? "").trim();

  await db.$transaction([
    db.transaction.update({ where: { id: tx.id }, data: { assigneeId: to.id, acceptedAt: null } }),
    db.transactionEvent.create({
      data: {
        transactionId: tx.id, userId: user.id, type: "ASSIGN", targetUserId: to.id,
        note: `${tx.assignee ? `أُسندت من ${tx.assignee.name} إلى` : "أُسندت إلى"} ${to.name}${note ? `\n${note}` : ""}`,
      },
    }),
  ]);
  refresh(tx.id);
  return { success: `تم إسناد المعاملة إلى ${to.name}` };
}

const acceptSchema = z.object({
  committedDue: dateKeySchema("يرجى تحديد الموعد الذي تتعهد بإنهاء المعاملة قبله"),
  jobTitle: optionalText,
  documents: optionalText.refine((v) => v === null || v.length <= 1000, { message: "قائمة المستندات طويلة جداً" }),
  pledgeSecrecy: z.literal("on", { message: "يرجى الإقرار بالحفاظ على سرية المستندات وسلامتها" }),
  pledgeEffort: z.literal("on", { message: "يرجى التعهد ببذل أقصى جهد لإنهاء الإجراءات" }),
});

// استلام المعاملة بإقرار وتعهد (للموظف المسؤول فقط)
export async function acceptTransaction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection("requests", "EDIT");
  const tx = await loadTx(String(fd.get("id")));
  if (!tx || !canSeeTx(user, tx)) return { error: "المعاملة غير موجودة" };
  if (tx.assigneeId !== user.id) return { error: "الاستلام للموظف المسؤول عن المعاملة فقط" };
  if (!awaitingAcceptance(tx)) return { error: "تم استلام هذه المعاملة مسبقاً" };
  const parsed = acceptSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { committedDue, jobTitle, documents } = parsed.data;
  if (committedDue < riyadhToday()) return { error: "لا يمكن أن يكون موعد الإنجاز في الماضي" };

  const text = pledgeText({ name: user.name, jobTitle, txNo: txNumber(tx.number), due: formatDate(committedDue) });
  await db.$transaction([
    db.txAcceptance.create({ data: { transactionId: tx.id, userId: user.id, jobTitle, committedDue, documents, pledgeText: text } }),
    db.transaction.update({ where: { id: tx.id }, data: { acceptedAt: new Date(), dueDate: committedDue } }),
    db.transactionEvent.create({
      data: { transactionId: tx.id, userId: user.id, type: "ACCEPT", note: `استلم المعاملة بتعهد، وموعد الإنجاز ${formatDate(committedDue)}` },
    }),
  ]);
  refresh(tx.id);
  return { success: "تم استلام المعاملة" };
}

const extensionSchema = z.object({
  requestedDue: dateKeySchema("يرجى تحديد الموعد الجديد المطلوب"),
  reason: z.string().trim().min(5, "يرجى توضيح سبب التأجيل").max(1000, "السبب طويل جداً"),
});

// طلب تأجيل موعد الإنجاز (يوافق عليه المدير المباشر أو صاحب الإدارة الكاملة)
export async function requestExtension(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection("requests", "EDIT");
  const tx = await loadTx(String(fd.get("id")));
  if (!tx || !canSeeTx(user, tx)) return { error: "المعاملة غير موجودة" };
  if (tx.stage.kind !== "OPEN") return { error: "المعاملة ليست جارية" };
  if (tx.assigneeId !== user.id) return { error: "طلب التأجيل للموظف المسؤول عن المعاملة فقط" };
  const parsed = extensionSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { requestedDue, reason } = parsed.data;
  if (requestedDue < riyadhToday()) return { error: "لا يمكن أن يكون الموعد الجديد في الماضي" };
  if (tx.dueDate && requestedDue <= tx.dueDate) return { error: "يجب أن يكون الموعد الجديد بعد الموعد الحالي" };
  if (await db.extensionRequest.findFirst({ where: { transactionId: tx.id, status: "PENDING" } })) {
    return { error: "يوجد طلب تأجيل سابق بانتظار القرار" };
  }

  await db.$transaction([
    db.extensionRequest.create({
      data: { transactionId: tx.id, requestedById: user.id, currentDue: tx.dueDate, requestedDue, reason },
    }),
    db.transactionEvent.create({
      data: {
        transactionId: tx.id, userId: user.id, type: "EXTENSION",
        note: `طلب تأجيل الموعد${tx.dueDate ? ` من ${formatDate(tx.dueDate)}` : ""} إلى ${formatDate(requestedDue)}\nالسبب: ${reason}`,
      },
    }),
  ]);
  refresh(tx.id);
  return { success: "تم إرسال طلب التأجيل" };
}

// الموافقة على طلب التأجيل أو رفضه
export async function decideExtension(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection("requests", "EDIT");
  const req = await db.extensionRequest.findUnique({ where: { id: String(fd.get("id")) }, include: { transaction: true } });
  if (!req || req.status !== "PENDING") return { error: "الطلب غير موجود أو تم البت فيه" };
  if (!canSeeTx(user, req.transaction)) return { error: "المعاملة غير موجودة" };
  if (!(await isManagerOf(db, user, req.requestedById))) return { error: "ليست لديك صلاحية البت في هذا الطلب" };
  const approve = fd.get("decision") === "APPROVED";
  const note = String(fd.get("decisionNote") ?? "").trim() || null;

  await db.$transaction([
    db.extensionRequest.update({
      where: { id: req.id },
      data: { status: approve ? "APPROVED" : "REJECTED", decidedById: user.id, decidedAt: new Date(), decisionNote: note },
    }),
    ...(approve ? [db.transaction.update({ where: { id: req.transactionId }, data: { dueDate: req.requestedDue } })] : []),
    db.transactionEvent.create({
      data: {
        transactionId: req.transactionId, userId: user.id, type: "EXTENSION", targetUserId: req.requestedById,
        note: `${approve ? `تمت الموافقة على التأجيل إلى ${formatDate(req.requestedDue)}` : "رُفض طلب التأجيل"}${note ? `\n${note}` : ""}`,
      },
    }),
  ]);
  refresh(req.transactionId);
  revalidatePath("/requests/all");
  return { success: approve ? "تمت الموافقة على التأجيل" : "تم رفض الطلب" };
}

// لفت نظر الموظف المسؤول (المدير المباشر أو صاحب الإدارة الكاملة)
export async function warnAssignee(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection("requests", "EDIT");
  const tx = await loadTx(String(fd.get("id")));
  if (!tx || !canSeeTx(user, tx)) return { error: "المعاملة غير موجودة" };
  if (!tx.assigneeId) return { error: "لا يوجد موظف مسؤول عن المعاملة" };
  if (!(await isManagerOf(db, user, tx.assigneeId))) return { error: "لفت النظر للمدير المباشر أو صاحب الإدارة الكاملة فقط" };
  const note = String(fd.get("note") ?? "").trim();
  if (note.length < 5) return { error: "يرجى كتابة سبب لفت النظر" };

  await db.transactionEvent.create({
    data: { transactionId: tx.id, userId: user.id, type: "WARNING", targetUserId: tx.assigneeId, note: `لفت نظر إلى ${tx.assignee!.name}: ${note}` },
  });
  refresh(tx.id);
  return { success: "تم تسجيل لفت النظر" };
}
