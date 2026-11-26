"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSection } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/company";
import { db } from "@/lib/db";
import { pickAssignee } from "@/lib/transactions";
import { type FormState, firstError, optionalMoney, optionalText } from "@/lib/forms";
import { isEditable, lineTotal, quoteNumber, quoteTotals } from "@/lib/quotes";
import { DAY_MS, riyadhToday } from "@/lib/time";

const headSchema = z.object({
  clientId: z.string().min(1, "يرجى اختيار العميل"),
  companyId: optionalText,
  title: z.string().trim().min(3, "يرجى إدخال عنوان واضح لعرض السعر"),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "يرجى إدخال تاريخ صلاحية العرض"),
  paymentTerms: optionalText,
  notes: optionalText,
  govFees: optionalMoney,
});

type Item = { description: string; quantity: number; unitPrice: number; serviceTypeId: string | null };

// البنود تصل كقوائم متوازية: item_desc[] / item_qty[] / item_price[] / item_service[]
function parseItems(fd: FormData): { items?: Item[]; error?: string } {
  const desc = fd.getAll("item_desc").map(String);
  const qty = fd.getAll("item_qty").map(String);
  const price = fd.getAll("item_price").map(String);
  const service = fd.getAll("item_service").map(String);
  const items: Item[] = [];
  for (let i = 0; i < desc.length; i++) {
    const d = desc[i].trim(), q = (qty[i] ?? "").trim(), p = (price[i] ?? "").trim();
    if (!d && !p) continue; // صف فارغ
    const n = i + 1;
    if (d.length < 2) return { error: `يرجى إدخال وصف البند رقم ${n}` };
    if (!/^\d+(\.\d{1,2})?$/.test(q) || Number(q) <= 0 || Number(q) > 99999) return { error: `الكمية في البند رقم ${n} غير صحيحة` };
    if (!/^\d+(\.\d{1,2})?$/.test(p)) return { error: `السعر في البند رقم ${n} يجب أن يكون رقماً (مثال: 1500 أو 1500.50)` };
    items.push({ description: d, quantity: Number(q), unitPrice: Number(p), serviceTypeId: service[i] || null });
  }
  if (items.length === 0) return { error: "يرجى إضافة بند واحد على الأقل" };
  if (items.length > 50) return { error: "الحد الأقصى 50 بنداً في العرض الواحد" };
  return { items };
}

async function validate(fd: FormData) {
  const parsed = headSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { items, error } = parseItems(fd);
  if (error) return { error };
  const h = parsed.data;
  const validUntil = new Date(`${h.validUntil}T00:00:00Z`);
  if (validUntil < riyadhToday()) return { error: "تاريخ صلاحية العرض لا يمكن أن يكون في الماضي" };
  if (h.companyId && !(await db.company.findFirst({ where: { id: h.companyId, clientId: h.clientId } }))) {
    return { error: "الشركة المختارة لا تتبع هذا العميل" };
  }
  const totals = quoteTotals(items!);
  return {
    data: {
      clientId: h.clientId, companyId: h.companyId, title: h.title, validUntil,
      paymentTerms: h.paymentTerms, notes: h.notes, govFees: h.govFees, ...totals,
    },
    items: items!.map((it, order) => ({ ...it, order, lineTotal: lineTotal(it) })),
  };
}

export async function createQuote(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection("requests", "EDIT");
  const v = await validate(fd);
  if ("error" in v) return { error: v.error };
  const q = await db.quote.create({
    data: { ...v.data, issueDate: riyadhToday(), createdById: user.id, items: { create: v.items } },
  });
  redirect(`/requests/quotes/${q.id}`);
}

export async function updateQuote(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireSection("requests", "EDIT");
  const id = String(fd.get("id"));
  const q = await db.quote.findUnique({ where: { id } });
  if (!q) return { error: "عرض السعر غير موجود" };
  if (!isEditable(q.status)) return { error: "لا يمكن تعديل عرض سعر تم قبوله أو رفضه أو إلغاؤه" };
  const v = await validate(fd);
  if ("error" in v) return { error: v.error };
  await db.$transaction([
    db.quoteItem.deleteMany({ where: { quoteId: id } }),
    db.quote.update({ where: { id }, data: { ...v.data, items: { create: v.items } } }),
  ]);
  revalidatePath(`/requests/quotes/${id}`);
  return { success: "تم حفظ التعديلات" };
}

// إرسال / قبول / رفض / إلغاء / إعادة لمسودة
export async function changeQuoteStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireSection("requests", "EDIT");
  const id = String(fd.get("id"));
  const op = String(fd.get("op"));
  const q = await db.quote.findUnique({ where: { id } });
  if (!q) return { error: "عرض السعر غير موجود" };
  const open = isEditable(q.status);
  const now = new Date();
  if (op === "send" && q.status === "DRAFT") {
    await db.quote.update({ where: { id }, data: { status: "SENT", sentAt: now } });
  } else if (op === "accept" && open) {
    await db.quote.update({ where: { id }, data: { status: "ACCEPTED", decidedAt: now } });
  } else if (op === "reject" && open) {
    const reason = String(fd.get("rejectReason") ?? "").trim();
    await db.quote.update({ where: { id }, data: { status: "REJECTED", decidedAt: now, rejectReason: reason || null } });
  } else if (op === "cancel" && open) {
    await db.quote.update({ where: { id }, data: { status: "CANCELLED", decidedAt: now } });
  } else if (op === "reopen" && (q.status === "REJECTED" || q.status === "CANCELLED")) {
    await requireSection("requests", "MANAGE");
    await db.quote.update({ where: { id }, data: { status: "DRAFT", decidedAt: null, rejectReason: null } });
  } else {
    return { error: "لا يمكن تنفيذ هذا الإجراء على العرض في حالته الحالية" };
  }
  revalidatePath(`/requests/quotes/${id}`);
  revalidatePath("/requests/quotes");
  return { success: "تم تحديث حالة العرض" };
}

// تحويل العرض المقبول إلى معاملة
export async function convertQuoteToTransaction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection("requests", "EDIT");
  const id = String(fd.get("id"));
  const q = await db.quote.findUnique({ where: { id }, include: { items: { orderBy: { order: "asc" }, include: { serviceType: true } } } });
  if (!q) return { error: "عرض السعر غير موجود" };
  if (q.status !== "ACCEPTED") return { error: "يجب قبول العرض أولاً" };
  if (q.transactionId) return { error: "تم تحويل هذا العرض إلى معاملة مسبقاً" };
  const companyId = q.companyId ?? (String(fd.get("companyId") ?? "") || null);
  if (!companyId) return { error: "يرجى اختيار الشركة التي ستُنفّذ لها المعاملة" };
  if (!(await db.company.findFirst({ where: { id: companyId, clientId: q.clientId } }))) return { error: "الشركة المختارة لا تتبع هذا العميل" };
  const firstStage = await db.stage.findFirst({ where: { active: true, kind: "OPEN" }, orderBy: { order: "asc" } });
  if (!firstStage) return { error: "لا توجد مراحل معرّفة — يرجى إضافة المراحل من الإعدادات أولاً" };

  const service = q.items.find((i) => i.serviceType)?.serviceType ?? null;
  const assignee = await pickAssignee(db, service?.id ?? null); // التوزيع التلقائي
  const tx = await db.transaction.create({
    data: {
      title: q.title,
      description: q.items.map((i) => `• ${i.description}`).join("\n"),
      companyId,
      serviceTypeId: service?.id ?? null,
      govEntityId: service?.govEntityId ?? null,
      fee: q.subtotal,
      govFees: q.govFees,
      stageId: firstStage.id,
      createdById: user.id,
      assigneeId: assignee?.id ?? null,
      events: {
        create: [
          { stageId: firstStage.id, note: `تم إنشاء المعاملة من عرض السعر ${quoteNumber(q.number)}`, userId: user.id },
          ...(assignee ? [{ type: "ASSIGN" as const, userId: user.id, targetUserId: assignee.id, createdAt: new Date(Date.now() + 1000), note: `أُسندت تلقائياً إلى ${assignee.name} (الأقل انشغالاً)` }] : []),
        ],
      },
    },
  });
  await db.quote.update({ where: { id }, data: { transactionId: tx.id, companyId } });
  redirect(`/requests/all/${tx.id}`);
}

// نسخ العرض (مثلاً بعد انتهاء صلاحيته) كمسودة جديدة بتاريخ صلاحية جديد
export async function duplicateQuote(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection("requests", "EDIT");
  const id = String(fd.get("id"));
  const q = await db.quote.findUnique({ where: { id }, include: { items: true } });
  if (!q) return { error: "عرض السعر غير موجود" };
  const { quoteValidityDays } = await getCompanyProfile();
  const today = riyadhToday();
  const copy = await db.quote.create({
    data: {
      clientId: q.clientId, companyId: q.companyId, title: q.title, issueDate: today,
      validUntil: new Date(today.getTime() + quoteValidityDays * DAY_MS),
      vatRate: q.vatRate, subtotal: q.subtotal, vatAmount: q.vatAmount, total: q.total, govFees: q.govFees,
      paymentTerms: q.paymentTerms, notes: q.notes, createdById: user.id,
      items: { create: q.items.map(({ order, description, serviceTypeId, quantity, unitPrice, lineTotal }) => ({ order, description, serviceTypeId, quantity, unitPrice, lineTotal })) },
    },
  });
  redirect(`/requests/quotes/${copy.id}`);
}

// حذف المسودات فقط (صلاحية إدارة)
export async function deleteQuote(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireSection("requests", "MANAGE");
  const id = String(fd.get("id"));
  const q = await db.quote.findUnique({ where: { id } });
  if (!q) return { error: "عرض السعر غير موجود" };
  if (q.status !== "DRAFT") return { error: "يمكن حذف المسودات فقط؛ استخدم الإلغاء للعروض المرسلة" };
  await db.quote.delete({ where: { id } });
  redirect("/requests/quotes");
}
