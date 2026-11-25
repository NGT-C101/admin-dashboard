import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Department, PermLevel, User } from "@prisma/client";
import { db } from "./db";
import { SESSION_COOKIE, decryptSession } from "./session";
import { findSection, type Section } from "./nav";

export type CurrentUser = Pick<User, "id" | "name" | "email" | "role" | "mustChangePassword"> & {
  isAdmin: boolean;
  perms: Partial<Record<Department, PermLevel>>;
  employeeId: string | null;
};

const RANK: Record<PermLevel, number> = { VIEW: 1, EDIT: 2, MANAGE: 3 };

// المستخدم الحالي وصلاحياته (أو null لو غير مسجّل الدخول)
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await decryptSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true, name: true, email: true, role: true, active: true, mustChangePassword: true,
      permissions: { select: { section: true, level: true } },
      employee: { select: { id: true } },
    },
  });
  if (!user || !user.active) return null;
  return {
    id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword,
    isAdmin: user.role === "ADMIN",
    perms: Object.fromEntries(user.permissions.map((p) => [p.section, p.level])),
    employeeId: user.employee?.id ?? null,
  };
});

// allowPasswordChange: صفحة "حسابي" مسموحة حتى لو لازم يغيّر كلمة المرور
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/account?first=1");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}

// هل المستخدم عنده المستوى ده (أو أعلى) على القسم؟
export function can(user: CurrentUser, section: Pick<Section, "department"> | string, level: PermLevel = "VIEW") {
  if (user.isAdmin) return true;
  const dept = typeof section === "string" ? findSection(section)?.department : section.department;
  const have = dept ? user.perms[dept] : undefined;
  return !!have && RANK[have] >= RANK[level];
}

export function canAccess(user: CurrentUser, section: Pick<Section, "department">) {
  return can(user, section, "VIEW");
}

// لازم يكون عنده المستوى المطلوب على القسم، وإلا يرجع للرئيسية
export async function requireSection(slug: string, level: PermLevel = "VIEW") {
  const user = await requireUser();
  if (!can(user, slug, level)) redirect("/");
  return user;
}

export type { Department, PermLevel };
