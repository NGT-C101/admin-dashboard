"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { can, requireSection, requireUser } from "@/lib/auth";
import { OPEN_CUSTODY, SECTION, assetNumber, custodyPledge } from "@/lib/assets";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalMoney, optionalText } from "@/lib/forms";
import { parseDateKey } from "@/lib/time";

const day = optionalText.refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "تاريخ غير صحيح" })
  .transform((v) => (v ? parseDateKey(v) : null));
const refresh = (assetId?: string) => {
  if (assetId) revalidatePath(`/admin-affairs/assets/${assetId}`);
  revalidatePath("/admin-affairs/assets");
  revalidatePath("/me");
  revalidatePath("/");
};

const assetSchema = z.object({
  name: z.string().trim().min(2, "يرجى إدخال اسم الأصل، مثل: حاسب محمول Dell Latitude").max(200),
  categoryId: z.string().min(1, "يرجى اختيار التصنيف"),
  brand: optionalText,
  serialNumber: optionalText,
  location: optionalText,
  purchaseDate: day,
  purchasePrice: optionalMoney,
  supplier: optionalText,
  warrantyEnd: day,
  notes: optionalText,
});

export async function saveAsset(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION, "EDIT");
  const parsed = assetSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (d.purchaseDate && d.warrantyEnd && d.warrantyEnd < d.purchaseDate) return { error: "يجب أن يكون انتهاء الضمان بعد تاريخ الشراء" };
  if (d.serialNumber) {
    const dup = await db.asset.findFirst({ where: { serialNumber: d.serialNumber, NOT: fd.get("id") ? { id: String(fd.get("id")) } : undefined }, select: { number: true } });
    if (dup) return { error: `الرقم التسلسلي مسجّل مسبقاً للأصل ${assetNumber(dup.number)}` };
  }
  const id = String(fd.get("id") ?? "");
  if (id) {
    await db.asset.update({ where: { id }, data: d });
    refresh(id);
    return { success: "تم حفظ التعديلات" };
  }
  const a = await db.asset.create({ data: { ...d, createdById: user.id } });
  redirect(`/admin-affairs/assets/${a.id}`);
}

// تغيير حالة الأصل (صيانة، استبعاد، مفقود، متاح) — لصاحب الإدارة الكاملة، ولا يكون في عهدة
export async function setAssetStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireSection(SECTION, "MANAGE");
  const a = await db.asset.findUnique({ where: { id: String(fd.get("id")) }, include: { custodies: { where: OPEN_CUSTODY, select: { id: true } } } });
  if (!a) return { error: "الأصل غير موجود" };
  const status = z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED", "LOST"]).safeParse(fd.get("status"));
  if (!status.success) return { error: "يرجى اختيار الحالة" };
  if (a.custodies.length) return { error: "الأصل في عهدة موظف. سجّل إعادته أولاً ثم غيّر حالته" };
  const note = String(fd.get("note") ?? "").trim();
  await db.asset.update({
    where: { id: a.id },
    data: { status: status.data, ...(note && { notes: [a.notes, `${new Date().toISOString().slice(0, 10)}: ${note}`].filter(Boolean).join("\n") }) },
  });
  refresh(a.id);
  return { success: "تم تحديث حالة الأصل" };
}

// تسليم الأصل لموظف كعهدة (بانتظار إقراره)
export async function assignCustody(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION, "EDIT");
  const a = await db.asset.findUnique({ where: { id: String(fd.get("assetId")) } });
  if (!a) return { error: "الأصل غير موجود" };
  if (a.status !== "AVAILABLE") return { error: "لا يمكن تسليم الأصل إلا إذا كانت حالته «متاح»" };
  const emp = await db.employee.findUnique({ where: { id: String(fd.get("employeeId") ?? "") }, select: { id: true, status: true } });
  if (!emp) return { error: "يرجى اختيار الموظف" };
  if (emp.status === "TERMINATED") return { error: "لا يمكن تسليم عهدة لموظف منتهية خدمته" };
  const conditionOut = String(fd.get("conditionOut") ?? "").trim() || null;
  const note = String(fd.get("note") ?? "").trim() || null;
  await db.$transaction([
    db.custody.create({ data: { assetId: a.id, employeeId: emp.id, assignedById: user.id, conditionOut, note } }),
    db.asset.update({ where: { id: a.id }, data: { status: "IN_CUSTODY" } }),
  ]);
  refresh(a.id);
  return { success: "تم تسليم الأصل، وبانتظار إقرار الموظف بالاستلام" };
}

// إقرار الموظف بالاستلام من «خدماتي»، أو تسجيل نموذج موقّع ورقياً (إدارة كاملة)
export async function acknowledgeCustody(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const c = await db.custody.findUnique({
    where: { id: String(fd.get("id")) },
    include: { asset: true, employee: { select: { fullName: true } } },
  });
  if (!c || c.status !== "PENDING") return { error: "العهدة غير موجودة أو تم الإقرار بها" };
  const paper = fd.get("method") === "PAPER";
  if (paper ? !can(user, SECTION, "MANAGE") : user.employeeId !== c.employeeId) {
    return { error: paper ? "تسجيل النموذج الورقي لصاحب الإدارة الكاملة على الشؤون الإدارية" : "الإقرار للموظف المستلم فقط" };
  }
  if (!paper && fd.get("pledge") !== "on") return { error: "يرجى الموافقة على الإقرار والتعهد" };
  await db.custody.update({
    where: { id: c.id },
    data: {
      status: "ACTIVE", acknowledgedAt: new Date(), ackMethod: paper ? "PAPER" : "PLATFORM",
      ackText: custodyPledge({ employee: c.employee.fullName, asset: c.asset.name, number: assetNumber(c.asset.number), serial: c.asset.serialNumber, condition: c.conditionOut }),
    },
  });
  refresh(c.assetId);
  return { success: paper ? "تم تسجيل النموذج الموقّع" : "تم الإقرار باستلام العهدة" };
}

// استلام الأصل من الموظف (إعادة العهدة)
export async function returnCustody(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireSection(SECTION, "EDIT");
  const c = await db.custody.findUnique({ where: { id: String(fd.get("id")) } });
  if (!c || c.status === "RETURNED") return { error: "العهدة غير موجودة أو أُعيدت مسبقاً" };
  const next = z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED", "LOST"]).safeParse(fd.get("assetStatus") ?? "AVAILABLE");
  if (!next.success) return { error: "يرجى اختيار حالة الأصل بعد الإعادة" };
  const conditionIn = String(fd.get("conditionIn") ?? "").trim() || null;
  const returnNote = String(fd.get("returnNote") ?? "").trim() || null;
  if (next.data !== "AVAILABLE" && !returnNote) return { error: "يرجى توضيح سبب الصيانة أو الاستبعاد أو الفقد في الملاحظات" };
  await db.$transaction([
    db.custody.update({ where: { id: c.id }, data: { status: "RETURNED", returnedAt: new Date(), conditionIn, returnNote, receivedById: user.id } }),
    db.asset.update({ where: { id: c.assetId }, data: { status: next.data } }),
  ]);
  refresh(c.assetId);
  return { success: "تم تسجيل إعادة العهدة" };
}

// تصنيفات الأصول (إدارة كاملة)
export async function saveCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireSection(SECTION, "MANAGE");
  const parsed = z.object({
    name: z.string().trim().min(2, "يرجى إدخال اسم التصنيف").max(80),
    order: z.coerce.number().int().min(0).default(0),
    active: z.string().optional().transform((v) => v !== "off"),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const id = String(fd.get("id") ?? "");
  try {
    if (id) await db.assetCategory.update({ where: { id }, data: parsed.data });
    else await db.assetCategory.create({ data: parsed.data });
  } catch {
    return { error: "يوجد تصنيف بالاسم نفسه" };
  }
  revalidatePath("/admin-affairs/assets");
  return { success: id ? "تم الحفظ" : "تمت الإضافة" };
}
