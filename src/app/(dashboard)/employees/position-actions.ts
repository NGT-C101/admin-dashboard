"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalText } from "@/lib/forms";

function revalidateAll() {
  revalidatePath("/employees/management");
  revalidatePath("/employees/org-chart");
  revalidatePath("/employees/profiles");
}

const schema = z.object({
  id: optionalText,
  title: z.string().trim().min(3, "يرجى إدخال مسمى المنصب"),
  level: z.enum(["EXECUTIVE", "SENIOR", "DEPARTMENT"]),
  scope: optionalText,
  parentId: optionalText,
  order: z.coerce.number().int().min(0).default(0),
});

async function createsCycle(id: string, parentId: string | null) {
  let cur = parentId;
  for (let i = 0; cur && i < 50; i++) {
    if (cur === id) return true;
    cur = (await db.position.findUnique({ where: { id: cur }, select: { parentId: true } }))?.parentId ?? null;
  }
  return false;
}

export async function savePosition(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("employees", "MANAGE");
  const p = schema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: firstError(p.error) };
  const { id, ...data } = p.data;
  if (id && (await createsCycle(id, data.parentId))) return { error: "لا يمكن أن يتبع المنصب نفسه أو أحد المناصب التابعة له" };
  const dup = await db.position.findFirst({ where: { title: data.title, NOT: id ? { id } : undefined } });
  if (dup) return { error: "يوجد منصب بالمسمى نفسه" };
  if (id) await db.position.update({ where: { id }, data });
  else await db.position.create({ data });
  revalidateAll();
  return { success: id ? "تم حفظ المنصب" : "تمت إضافة المنصب" };
}

export async function deletePosition(formData: FormData) {
  await requireSection("employees", "MANAGE");
  const id = String(formData.get("id"));
  if (await db.position.count({ where: { parentId: id } })) return; // له مناصب تابعة
  await db.position.delete({ where: { id } });
  revalidateAll();
}

// أقرب شاغل لمنصب أعلى (لو المنصب الأعلى مباشرة شاغر نطلع للي فوقه)
async function nearestHolderAbove(positionId: string) {
  let cur = (await db.position.findUnique({ where: { id: positionId }, select: { parentId: true } }))?.parentId ?? null;
  for (let i = 0; cur && i < 50; i++) {
    const p = await db.position.findUnique({ where: { id: cur }, select: { holderId: true, parentId: true } });
    if (p?.holderId) return p.holderId;
    cur = p?.parentId ?? null;
  }
  return null;
}

// تعيين شاغل المنصب + ضبط "المدير المباشر" تلقائياً حسب الهيكل
export async function assignHolder(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("employees", "MANAGE");
  const positionId = String(formData.get("positionId"));
  const employeeId = String(formData.get("employeeId") ?? "") || null;
  const pos = await db.position.findUnique({ where: { id: positionId } });
  if (!pos) return { error: "المنصب غير موجود" };

  await db.$transaction(async (tx) => {
    if (employeeId) await tx.position.updateMany({ where: { holderId: employeeId, NOT: { id: positionId } }, data: { holderId: null } });
    await tx.position.update({ where: { id: positionId }, data: { holderId: employeeId } });
  });

  if (employeeId) {
    const boss = await nearestHolderAbove(positionId);
    if (boss && boss !== employeeId) await db.employee.update({ where: { id: employeeId }, data: { managerId: boss } });
    // شاغلو المناصب التابعة مباشرة يتبعون الشاغل الجديد
    const kids = await db.position.findMany({ where: { parentId: positionId, holderId: { not: null } }, select: { holderId: true } });
    for (const k of kids) if (k.holderId !== employeeId) await db.employee.update({ where: { id: k.holderId! }, data: { managerId: employeeId } });
  }
  revalidateAll();
  return { success: employeeId ? "تم تعيين شاغل المنصب وتحديث المدير المباشر" : "أصبح المنصب شاغراً" };
}
