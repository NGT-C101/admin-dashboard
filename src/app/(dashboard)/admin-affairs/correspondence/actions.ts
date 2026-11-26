"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalText } from "@/lib/forms";
import { SECTION, canApprove, canEditLetter, canReview, letterNumber, nextSeq } from "@/lib/letters";
import { dateKey, parseDateKey, riyadhToday } from "@/lib/time";

const path = (id: string) => `/admin-affairs/correspondence/${id}`;
const refresh = (id?: string) => {
  if (id) revalidatePath(path(id));
  revalidatePath("/admin-affairs/correspondence");
  revalidatePath("/");
};
const optionalDay = optionalText.refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "تاريخ غير صحيح" })
  .transform((v) => (v ? parseDateKey(v) : null));

const outgoingSchema = z.object({
  subject: z.string().trim().min(3, "يرجى إدخال موضوع الخطاب").max(300),
  party: z.string().trim().min(2, "يرجى إدخال الجهة الموجّه إليها الخطاب").max(300),
  partyRef: optionalText,
  body: z.string().trim().min(10, "يرجى كتابة نص الخطاب").max(20000, "نص الخطاب طويل جداً"),
  clientId: optionalText,
  hideLogo: z.string().optional().transform((v) => v === "on"),
});

// إنشاء أو تعديل خطاب صادر (مسودة أو مُعاد للتعديل)
export async function saveOutgoing(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION, "EDIT");
  const parsed = outgoingSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const id = String(fd.get("id") ?? "");
  if (id) {
    const l = await db.letter.findUnique({ where: { id } });
    if (!l || !canEditLetter(user, l)) return { error: "لا يمكن تعديل هذا الخطاب في حالته الحالية" };
    await db.letter.update({ where: { id }, data: parsed.data });
    refresh(id);
    return { success: "تم حفظ التعديلات" };
  }
  const l = await db.letter.create({
    data: {
      ...parsed.data, direction: "OUTGOING", status: "DRAFT", createdById: user.id,
      events: { create: { userId: user.id, note: "أُنشئت مسودة الخطاب" } },
    },
  });
  redirect(path(l.id));
}

async function loadLetter(fd: FormData) {
  return db.letter.findUnique({ where: { id: String(fd.get("id")) } });
}

// إرسال المسودة للمراجعة
export async function submitLetter(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION, "EDIT");
  const l = await loadLetter(fd);
  if (!l || !canEditLetter(user, l)) return { error: "لا يمكن إرسال هذا الخطاب للمراجعة" };
  await db.letter.update({
    where: { id: l.id },
    data: { status: "IN_REVIEW", events: { create: { userId: user.id, note: "أُرسل الخطاب للمراجعة" } } },
  });
  refresh(l.id);
  return { success: "تم الإرسال للمراجعة" };
}

// المراجعة (تصديق أو إعادة للتعديل)
export async function reviewLetter(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION);
  const l = await loadLetter(fd);
  if (!l || !(await canReview(db, user, l))) return { error: "ليست لديك صلاحية مراجعة هذا الخطاب" };
  const ok = fd.get("decision") === "OK";
  const note = String(fd.get("note") ?? "").trim();
  if (!ok && note.length < 3) return { error: "يرجى توضيح المطلوب تعديله" };
  await db.letter.update({
    where: { id: l.id },
    data: ok
      ? { status: "REVIEWED", reviewedById: user.id, reviewedAt: new Date(), events: { create: { userId: user.id, note: `تمت مراجعة الخطاب وتصديقه${note ? `\n${note}` : ""}` } } }
      : { status: "RETURNED", events: { create: { userId: user.id, note: `أُعيد الخطاب للتعديل في مرحلة المراجعة\n${note}` } } },
  });
  refresh(l.id);
  return { success: ok ? "تم التصديق، والخطاب بانتظار الاعتماد" : "تمت إعادة الخطاب للتعديل" };
}

// الاعتماد: يُمنح رقم صادر سنوي وتاريخ ورمز تحقق
export async function approveLetter(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION);
  const l = await loadLetter(fd);
  if (!l || !canApprove(user, l)) return { error: "ليست لديك صلاحية اعتماد هذا الخطاب" };
  const ok = fd.get("decision") === "OK";
  const note = String(fd.get("note") ?? "").trim();
  if (!ok) {
    if (note.length < 3) return { error: "يرجى توضيح المطلوب تعديله" };
    await db.letter.update({
      where: { id: l.id },
      data: { status: "RETURNED", events: { create: { userId: user.id, note: `أُعيد الخطاب للتعديل في مرحلة الاعتماد\n${note}` } } },
    });
    refresh(l.id);
    return { success: "تمت إعادة الخطاب للتعديل" };
  }
  const today = riyadhToday();
  const year = Number(dateKey(today).slice(0, 4));
  // محاولة ثانية عند تزامن اعتماد خطابين في اللحظة نفسها
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const num = await db.$transaction(async (tx) => {
        const seq = await nextSeq(tx, "OUTGOING", year);
        await tx.letter.update({
          where: { id: l.id },
          data: {
            status: "APPROVED", year, seq, letterDate: today, approvedById: user.id, approvedAt: new Date(),
            verifyToken: randomBytes(16).toString("hex"),
          },
        });
        const n = letterNumber({ direction: "OUTGOING", year, seq })!;
        await tx.letterEvent.create({ data: { letterId: l.id, userId: user.id, note: `اعتُمد الخطاب برقم صادر ${n}${note ? `\n${note}` : ""}` } });
        return n;
      });
      refresh(l.id);
      return { success: `تم اعتماد الخطاب برقم ${num}` };
    } catch (e) {
      if (!(typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") || attempt === 2) throw e;
    }
  }
  return { error: "تعذر الاعتماد، يرجى المحاولة مرة أخرى" };
}

// إلغاء خطاب: غير المعتمد لكاتبه أو للإدارة الكاملة، والمعتمد للإدارة الكاملة فقط (تظهر صفحة التحقق «ملغى»)
export async function cancelLetter(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION, "EDIT");
  const l = await loadLetter(fd);
  if (!l || l.status === "CANCELLED") return { error: "الخطاب غير موجود أو ملغى" };
  const manage = can(user, SECTION, "MANAGE");
  const allowed = l.status === "APPROVED" || l.status === "RECEIVED" ? manage : manage || l.createdById === user.id;
  if (!allowed) return { error: "ليست لديك صلاحية إلغاء هذا الخطاب" };
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 3) return { error: "يرجى كتابة سبب الإلغاء" };
  await db.letter.update({
    where: { id: l.id },
    data: { status: "CANCELLED", events: { create: { userId: user.id, note: `أُلغي الخطاب\nالسبب: ${reason}` } } },
  });
  refresh(l.id);
  return { success: "تم إلغاء الخطاب" };
}

const incomingSchema = z.object({
  subject: z.string().trim().min(3, "يرجى إدخال موضوع الخطاب").max(300),
  party: z.string().trim().min(2, "يرجى إدخال الجهة المرسلة").max(300),
  partyRef: optionalText,
  body: optionalText,
  letterDate: optionalDay,
  receivedAt: optionalDay,
  clientId: optionalText,
  assigneeId: optionalText,
});

// تسجيل خطاب وارد برقم وارد سنوي
export async function registerIncoming(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION, "EDIT");
  const parsed = incomingSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const receivedAt = d.receivedAt ?? riyadhToday();
  if (receivedAt > riyadhToday()) return { error: "لا يمكن أن يكون تاريخ الاستلام في المستقبل" };
  const year = Number(dateKey(receivedAt).slice(0, 4));
  const assignee = d.assigneeId ? await db.user.findFirst({ where: { id: d.assigneeId, active: true }, select: { name: true } }) : null;

  let id = "";
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    try {
      id = await db.$transaction(async (tx) => {
        const seq = await nextSeq(tx, "INCOMING", year);
        const l = await tx.letter.create({
          data: {
            ...d, receivedAt, direction: "INCOMING", status: "RECEIVED", year, seq, createdById: user.id,
            assigneeId: assignee ? d.assigneeId : null,
            events: { create: { userId: user.id, note: `سُجّل الخطاب الوارد${assignee ? ` وأُحيل إلى ${assignee.name}` : ""}` } },
          },
        });
        return l.id;
      });
    } catch (e) {
      if (!(typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") || attempt === 2) throw e;
    }
  }
  redirect(path(id));
}

// إحالة الوارد لموظف، أو تسجيل إتمام الإجراء
export async function updateIncoming(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION, "EDIT");
  const l = await loadLetter(fd);
  if (!l || l.direction !== "INCOMING" || l.status === "CANCELLED") return { error: "الخطاب غير موجود" };
  const note = String(fd.get("note") ?? "").trim();
  if (fd.get("op") === "done") {
    if (l.assigneeId !== user.id && !can(user, SECTION, "MANAGE")) return { error: "إتمام الإجراء للموظف المحال إليه أو للإدارة الكاملة" };
    await db.letter.update({
      where: { id: l.id },
      data: { actionDone: true, events: { create: { userId: user.id, note: `تم الإجراء على الخطاب الوارد${note ? `\n${note}` : ""}` } } },
    });
    refresh(l.id);
    return { success: "تم تسجيل إتمام الإجراء" };
  }
  const to = await db.user.findFirst({ where: { id: String(fd.get("assigneeId") ?? ""), active: true }, select: { id: true, name: true } });
  if (!to) return { error: "يرجى اختيار الموظف" };
  await db.letter.update({
    where: { id: l.id },
    data: { assigneeId: to.id, actionDone: false, events: { create: { userId: user.id, note: `أُحيل الخطاب إلى ${to.name}${note ? `\n${note}` : ""}` } } },
  });
  refresh(l.id);
  return { success: `تمت الإحالة إلى ${to.name}` };
}

const templateSchema = z.object({
  name: z.string().trim().min(2, "يرجى إدخال اسم القالب").max(100),
  subject: optionalText,
  body: z.string().trim().min(10, "يرجى كتابة نص القالب").max(20000),
  order: z.coerce.number().int().min(0).default(0),
  active: z.string().optional().transform((v) => v !== "off"),
});

// قوالب الخطابات (إدارة كاملة)
export async function saveTemplate(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireSection(SECTION, "MANAGE");
  const parsed = templateSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const id = String(fd.get("id") ?? "");
  try {
    if (id) await db.letterTemplate.update({ where: { id }, data: parsed.data });
    else await db.letterTemplate.create({ data: parsed.data });
  } catch {
    return { error: "يوجد قالب بالاسم نفسه" };
  }
  revalidatePath("/admin-affairs/correspondence");
  return { success: id ? "تم حفظ القالب" : "تمت إضافة القالب" };
}
