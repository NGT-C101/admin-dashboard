"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const createSchema = z
  .object({
    name: z.string().trim().min(2, "الاسم قصير جداً"),
    email: z.string().trim().toLowerCase().email("الإيميل غير صحيح"),
    password: z.string().min(8, "كلمة المرور لازم تكون 8 حروف على الأقل"),
    role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]),
    department: z
      .enum(["EMPLOYEES", "CLIENTS", "REQUESTS", "ADMIN_AFFAIRS", "ACCOUNTS", "PR"])
      .or(z.literal(""))
      .transform((v) => (v === "" ? null : v)),
  })
  .refine((d) => d.role === "ADMIN" || d.department, {
    message: "لازم تختار قسم لمدير القسم أو الموظف",
  });

export type FormState = { error?: string; success?: string } | undefined;

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { password, ...data } = parsed.data;
  if (await db.user.findUnique({ where: { email: data.email } })) {
    return { error: "الإيميل ده مستخدم قبل كده" };
  }
  await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/settings/users");
  return { success: `تم إضافة ${data.name}` };
}

export async function toggleUserActive(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === admin.id) return; // المدير ميقدرش يوقف نفسه
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return;
  await db.user.update({ where: { id }, data: { active: !user.active } });
  revalidatePath("/settings/users");
}
