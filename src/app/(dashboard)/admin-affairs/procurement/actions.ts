"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { can, requireSection, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatSAR } from "@/lib/format";
import { type FormState, firstError, optionalMoney, optionalText } from "@/lib/forms";
import { isValidSaudiIban, normalizeIban } from "@/lib/hr";
import {
  MAX_ASSET_UNITS, MAX_ITEMS, SECTION, canApprovePurchase, canManagerDecide, firstStatus, purchaseNumber,
} from "@/lib/purchases";
import { parseDateKey, riyadhToday } from "@/lib/time";

const path = (id: string) => `/admin-affairs/procurement/${id}`;
const refresh = (id?: string) => {
  if (id) revalidatePath(path(id));
  revalidatePath("/admin-affairs/procurement");
  revalidatePath("/admin-affairs/assets");
  revalidatePath("/me");
  revalidatePath("/");
};
const day = optionalText.refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "تاريخ غير صحيح" })
  .transform((v) => (v ? parseDateKey(v) : null));

// البنود تأتي كحقول متوازية: desc[] qty[] price[] asset[] cat[]
function readItems(fd: FormData) {
  const desc = fd.getAll("itemDesc").map((v) => String(v).trim());
  const qty = fd.getAll("itemQty").map(String);
  const price = fd.getAll("itemPrice").map((v) => String(v).trim());
  const cat = fd.getAll("itemCategory").map(String);
  const assetIdx = new Set(fd.getAll("itemAsset").map(Number));
  const items = [];
  for (let i = 0; i < desc.length; i++) {
    if (!desc[i]) continue;
    const quantity = Number(qty[i]);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return { error: `الكمية في البند «${desc[i]}» يجب أن تكون رقماً صحيحاً من 1 إلى 1000` };
    if (price[i] && !/^\d+(\.\d{1,2})?$/.test(price[i])) return { error: `السعر التقديري في البند «${desc[i]}» غير صحيح (مثال: 1500 أو 1500.50)` };
    const isAsset = assetIdx.has(i);
    if (isAsset && !cat[i]) return { error: `يرجى اختيار تصنيف الأصل للبند «${desc[i]}»` };
    if (isAsset && quantity > MAX_ASSET_UNITS) return { error: `لا يمكن تسجيل أكثر من ${MAX_ASSET_UNITS} أصلاً من بند واحد` };
    items.push({ order: items.length, description: desc[i].slice(0, 300), quantity, estUnitPrice: price[i] || null, isAsset, categoryId: isAsset ? cat[i] : null });
  }
  if (items.length === 0) return { error: "يرجى إضافة بند واحد على الأقل" };
  if (items.length > MAX_ITEMS) return { error: `الحد الأقصى ${MAX_ITEMS} بنداً` };
  return { items };
}

const requestSchema = z.object({
  title: z.string().trim().min(3, "يرجى إدخال عنوان واضح للطلب، مثل: أجهزة حاسب للموظفين الجدد").max(200),
  justification: z.string().trim().min(5, "يرجى توضيح سبب الحاجة").max(2000),
  neededBy: day,
});

// أي موظف يستطيع تقديم طلب شراء
export async function createPurchase(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (parsed.data.neededBy && parsed.data.neededBy < riyadhToday()) return { error: "لا يمكن أن يكون تاريخ الحاجة في الماضي" };
  const r = readItems(fd);
  if ("error" in r) return { error: r.error };
  const status = await firstStatus(db, user.id);
  const p = await db.purchaseRequest.create({
    data: {
      ...parsed.data, status, requestedById: user.id,
      items: { create: r.items },
      events: { create: { userId: user.id, note: status === "PENDING_MANAGER" ? "قُدّم الطلب وأُحيل للمدير المباشر" : "قُدّم الطلب وأُحيل لاعتماد الشؤون الإدارية" } },
    },
  });
  redirect(path(p.id));
}

async function load(fd: FormData) {
  return db.purchaseRequest.findUnique({ where: { id: String(fd.get("id")) }, include: { items: true } });
}

// موافقة المدير المباشر أو رفضه
export async function managerDecision(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = await load(fd);
  if (!p || !(await canManagerDecide(db, user, p))) return { error: "ليست لديك صلاحية البت في هذا الطلب" };
  const ok = fd.get("decision") === "OK";
  const note = String(fd.get("note") ?? "").trim();
  if (!ok && note.length < 3) return { error: "يرجى كتابة سبب الرفض" };
  await db.purchaseRequest.update({
    where: { id: p.id },
    data: ok
      ? { status: "PENDING_APPROVAL", managerById: user.id, managerAt: new Date(), events: { create: { userId: user.id, note: `وافق المدير المباشر وأُحيل الطلب لاعتماد الشؤون الإدارية${note ? `\n${note}` : ""}` } } }
      : { status: "REJECTED", managerById: user.id, managerAt: new Date(), rejectReason: note, events: { create: { userId: user.id, note: `رفض المدير المباشر الطلب\nالسبب: ${note}` } } },
  });
  refresh(p.id);
  return { success: ok ? "تمت الموافقة" : "تم رفض الطلب" };
}

// اعتماد الشؤون الإدارية أو رفضها
export async function approvalDecision(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION);
  const p = await load(fd);
  if (!p || !canApprovePurchase(user, p)) return { error: "ليست لديك صلاحية اعتماد هذا الطلب" };
  const ok = fd.get("decision") === "OK";
  const note = String(fd.get("note") ?? "").trim();
  if (!ok && note.length < 3) return { error: "يرجى كتابة سبب الرفض" };
  await db.purchaseRequest.update({
    where: { id: p.id },
    data: ok
      ? { status: "APPROVED", approvedById: user.id, approvedAt: new Date(), events: { create: { userId: user.id, note: `اعتُمد الطلب للشراء${note ? `\n${note}` : ""}` } } }
      : { status: "REJECTED", approvedById: user.id, approvedAt: new Date(), rejectReason: note, events: { create: { userId: user.id, note: `رُفض الطلب في الاعتماد\nالسبب: ${note}` } } },
  });
  refresh(p.id);
  return { success: ok ? "تم اعتماد الطلب" : "تم رفض الطلب" };
}

// إلغاء الطلب: لمقدّمه قبل الاعتماد، أو للإدارة الكاملة قبل الاستلام
export async function cancelPurchase(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = await load(fd);
  if (!p) return { error: "الطلب غير موجود" };
  const mine = p.requestedById === user.id && (p.status === "PENDING_MANAGER" || p.status === "PENDING_APPROVAL");
  const manage = can(user, SECTION, "MANAGE") && !["RECEIVED", "REJECTED", "CANCELLED"].includes(p.status);
  if (!mine && !manage) return { error: "لا يمكن إلغاء هذا الطلب في حالته الحالية" };
  const reason = String(fd.get("reason") ?? "").trim();
  await db.purchaseRequest.update({
    where: { id: p.id },
    data: { status: "CANCELLED", events: { create: { userId: user.id, note: `أُلغي الطلب${reason ? `\nالسبب: ${reason}` : ""}` } } },
  });
  refresh(p.id);
  return { success: "تم إلغاء الطلب" };
}

// عرض سعر من مورد (اختياري) — للشؤون الإدارية قبل الشراء
export async function addQuote(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION, "EDIT");
  const p = await load(fd);
  if (!p || !["PENDING_APPROVAL", "APPROVED"].includes(p.status)) return { error: "تُضاف العروض قبل اعتماد الطلب أو بعده وقبل الشراء" };
  const parsed = z.object({
    supplierId: z.string().min(1, "يرجى اختيار المورد"),
    amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "يرجى إدخال مبلغ العرض (مثال: 12500)"),
    notes: optionalText,
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const sup = await db.supplier.findUnique({ where: { id: parsed.data.supplierId }, select: { name: true } });
  if (!sup) return { error: "المورد غير موجود" };
  await db.$transaction([
    db.supplierQuote.create({ data: { purchaseId: p.id, ...parsed.data } }),
    db.purchaseEvent.create({ data: { purchaseId: p.id, userId: user.id, note: `أُضيف عرض سعر من ${sup.name}: ${formatSAR(parsed.data.amount)}` } }),
  ]);
  refresh(p.id);
  return { success: "تمت إضافة العرض" };
}

const receiveSchema = z.object({
  supplierId: z.string().min(1, "يرجى اختيار المورد الذي تم الشراء منه"),
  invoiceNumber: optionalText,
  totalActual: optionalMoney.refine((v) => v !== null, { message: "يرجى إدخال الإجمالي الفعلي شامل الضريبة" }),
  receivedAt: day,
});

// تسجيل الشراء والاستلام — البنود المعلَّمة كأصول تُضاف لسجل الأصول تلقائياً
export async function receivePurchase(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION, "EDIT");
  const p = await db.purchaseRequest.findUnique({ where: { id: String(fd.get("id")) }, include: { items: { orderBy: { order: "asc" } } } });
  if (!p || p.status !== "APPROVED") return { error: "يُسجَّل الاستلام للطلبات المعتمدة فقط" };
  const parsed = receiveSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const receivedAt = d.receivedAt ?? riyadhToday();
  if (receivedAt > riyadhToday()) return { error: "لا يمكن أن يكون تاريخ الاستلام في المستقبل" };
  const sup = await db.supplier.findUnique({ where: { id: d.supplierId }, select: { id: true, name: true } });
  if (!sup) return { error: "المورد غير موجود" };

  // السعر الفعلي لكل بند أصل (اختياري، وإلا يُستخدم السعر التقديري)
  const assetRows: { name: string; categoryId: string; price: string | null }[] = [];
  for (const it of p.items.filter((i) => i.isAsset && i.categoryId)) {
    const actual = String(fd.get(`actual_${it.id}`) ?? "").trim();
    if (actual && !/^\d+(\.\d{1,2})?$/.test(actual)) return { error: `سعر الوحدة الفعلي للبند «${it.description}» غير صحيح` };
    for (let k = 0; k < it.quantity; k++) {
      assetRows.push({ name: it.description, categoryId: it.categoryId!, price: actual || (it.estUnitPrice?.toString() ?? null) });
    }
  }

  await db.$transaction([
    db.purchaseRequest.update({
      where: { id: p.id },
      data: {
        status: "RECEIVED", supplierId: sup.id, invoiceNumber: d.invoiceNumber, totalActual: d.totalActual, receivedAt, receivedById: user.id,
        events: { create: { userId: user.id, note: `تم الشراء من ${sup.name} واستلام الطلب بإجمالي ${formatSAR(d.totalActual)}${assetRows.length ? `، وأُضيف ${assetRows.length} أصل لسجل الأصول` : ""}` } },
      },
    }),
    db.supplierQuote.updateMany({ where: { purchaseId: p.id }, data: { selected: false } }),
    db.supplierQuote.updateMany({ where: { purchaseId: p.id, supplierId: sup.id }, data: { selected: true } }),
    ...assetRows.map((a) => db.asset.create({
      data: {
        name: a.name, categoryId: a.categoryId, purchaseDate: receivedAt, purchasePrice: a.price, supplier: sup.name,
        notes: `من طلب الشراء ${purchaseNumber(p.number)}${d.invoiceNumber ? ` — فاتورة ${d.invoiceNumber}` : ""}`,
        createdById: user.id, purchaseId: p.id,
      },
    })),
  ]);
  refresh(p.id);
  return { success: assetRows.length ? `تم تسجيل الاستلام وإضافة ${assetRows.length} أصل لسجل الأصول` : "تم تسجيل الاستلام" };
}

const supplierSchema = z.object({
  name: z.string().trim().min(2, "يرجى إدخال اسم المورد").max(200),
  category: optionalText, contactName: optionalText, city: optionalText, notes: optionalText,
  phone: optionalText.refine((v) => v === null || /^[\d+\s-]{9,16}$/.test(v), { message: "رقم الجوال غير صحيح" }),
  email: optionalText.refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "البريد الإلكتروني غير صحيح" }),
  crNumber: optionalText.refine((v) => v === null || /^\d{10}$/.test(v), { message: "يجب أن يتكون السجل التجاري أو الرقم الموحد من 10 أرقام" }),
  vatNumber: optionalText.refine((v) => v === null || /^3\d{13}3$/.test(v), { message: "يجب أن يتكون الرقم الضريبي من 15 رقماً يبدأ وينتهي بـ 3" }),
  iban: optionalText.transform((v) => (v ? normalizeIban(v) : null)).refine((v) => v === null || isValidSaudiIban(v), { message: "رقم الآيبان غير صحيح" }),
  active: z.string().optional().transform((v) => v !== "off"),
});

export async function saveSupplier(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireSection(SECTION, "EDIT");
  const parsed = supplierSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const id = String(fd.get("id") ?? "");
  try {
    if (id) await db.supplier.update({ where: { id }, data: parsed.data });
    else await db.supplier.create({ data: parsed.data });
  } catch {
    return { error: "يوجد مورد مسجّل بالاسم نفسه" };
  }
  revalidatePath("/admin-affairs/procurement");
  if (id) revalidatePath(`/admin-affairs/procurement/suppliers/${id}`);
  return { success: id ? "تم حفظ بيانات المورد" : "تمت إضافة المورد" };
}
