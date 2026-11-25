import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Department, User } from "@prisma/client";
import { db } from "./db";
import { SESSION_COOKIE, decryptSession } from "./session";
import { findSection, type Section } from "./nav";

export type CurrentUser = Pick<User, "id" | "name" | "email" | "role" | "department">;

// المستخدم الحالي (أو null لو مش مسجّل دخول)
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await decryptSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, department: true, active: true },
  });
  if (!user || !user.active) return null;
  const { active: _active, ...rest } = user;
  return rest;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

// هل المستخدم يقدر يدخل القسم ده؟
export function canAccess(user: CurrentUser, section: Pick<Section, "department" | "sharedWith">) {
  if (user.role === "ADMIN") return true;
  if (!user.department) return false;
  return user.department === section.department || !!section.sharedWith?.includes(user.department);
}

// لازم يكون المستخدم له صلاحية على القسم، وإلا يرجع للرئيسية
export async function requireSection(slug: string) {
  const user = await requireUser();
  const section = findSection(slug);
  if (!section || !canAccess(user, section)) redirect("/");
  return user;
}

// المدير ومدير القسم بس يقدروا يعدّلوا البيانات الحساسة
export function isManager(user: CurrentUser) {
  return user.role === "ADMIN" || user.role === "MANAGER";
}

export type { Department };
