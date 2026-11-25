"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError } from "@/lib/forms";

const schema = z
  .object({
    current: z.string().min(1, "يرجى إدخال كلمة المرور الحالية"),
    next: z.string().min(10, "يجب ألا تقل كلمة المرور الجديدة عن 10 أحرف"),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "كلمة المرور الجديدة وتأكيدها غير متطابقين" })
  .refine((d) => d.next !== d.current, { message: "يجب أن تختلف كلمة المرور الجديدة عن الحالية" });

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const user = await db.user.findUnique({ where: { id: me.id } });
  if (!user || !(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return { error: "كلمة المرور الحالية غير صحيحة" };
  }
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) } });
  return { success: "تم تغيير كلمة المرور ✅" };
}
