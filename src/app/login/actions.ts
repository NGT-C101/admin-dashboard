"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { SESSION_COOKIE, encryptSession, sessionCookieOptions } from "@/lib/session";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "يرجى إدخال بريد إلكتروني وكلمة مرور صحيحين" };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user && user.active && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" };

  const store = await cookies();
  store.set(SESSION_COOKIE, await encryptSession({ userId: user.id }), sessionCookieOptions);
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
