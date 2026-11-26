"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError } from "@/lib/forms";
import { parsePermissions, savePermissions } from "@/lib/permissions";

export type { FormState } from "@/lib/forms";

const accountSchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جداً"),
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(10, "يجب ألا تقل كلمة المرور المؤقتة عن 10 أحرف"),
});

// حساب مستقل (من غير ملف موظف) — مثلاً لمدير نظام أو مستشار خارجي
export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) return { error: "البريد الإلكتروني مستخدم مسبقاً" };
  const perms = parsePermissions(formData);
  let id = "";
  await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { name: parsed.data.name, email: parsed.data.email, passwordHash: await bcrypt.hash(parsed.data.password, 10), mustChangePassword: true },
    });
    id = u.id;
    await savePermissions(tx, u.id, perms);
  });
  redirect(`/settings/users/${id}`);
}

export async function updateAccess(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const perms = parsePermissions(formData);
  // مدير النظام ما يقدرش يشيل الصلاحية من نفسه عشان المنصة ما تفضلش من غير مدير
  if (id === admin.id && !perms.isAdmin) return { error: "لا يمكنك إلغاء صلاحية مدير النظام عن حسابك" };
  await db.$transaction((tx) => savePermissions(tx, id, perms));
  revalidatePath(`/settings/users/${id}`);
  revalidatePath("/settings/users");
  return { success: "تم حفظ الصلاحيات ✅" };
}

export async function toggleUserActive(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === admin.id) return;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return;
  await db.user.update({ where: { id }, data: { active: !user.active } });
  revalidatePath(`/settings/users/${id}`);
  revalidatePath("/settings/users");
}

// كلمة مرور مؤقتة: المستخدم هيُطلب منه يغيّرها أول ما يدخل
export async function resetUserPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 10) return { error: "يجب ألا تقل كلمة المرور المؤقتة عن 10 أحرف" };
  await db.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: id !== admin.id },
  });
  return { success: "تم تعيين كلمة المرور المؤقتة ✅ — سيُطلب من المستخدم تغييرها عند الدخول" };
}

// إعدادات التوزيع التلقائي للمعاملات: الإدراج + الخدمات التي يتولاها (فارغة = كل الخدمات)
export async function saveAutoAssign(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id"));
  const autoAssign = formData.get("autoAssign") === "on";
  const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);
  const valid = serviceIds.length ? await db.serviceType.findMany({ where: { id: { in: serviceIds } }, select: { id: true } }) : [];
  await db.user.update({
    where: { id },
    data: { autoAssign, assignableServices: { set: valid.map((s) => ({ id: s.id })) } },
  });
  revalidatePath(`/settings/users/${id}`);
  revalidatePath("/settings/users");
  return { success: autoAssign ? "تم إدراج الموظف في التوزيع التلقائي" : "تم استبعاد الموظف من التوزيع التلقائي" };
}
