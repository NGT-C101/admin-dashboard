import "server-only";
import type { Department, PermLevel, Prisma } from "@prisma/client";
import { SECTIONS } from "./nav";

// قراءة مصفوفة الصلاحيات من الفورم
export function parsePermissions(formData: FormData) {
  const isAdmin = formData.get("isAdmin") === "on";
  const perms: { section: Department; level: PermLevel }[] = [];
  for (const s of SECTIONS) {
    const v = String(formData.get(`perm_${s.department}`) ?? "NONE");
    if (v === "VIEW" || v === "EDIT" || v === "MANAGE") perms.push({ section: s.department, level: v });
  }
  return { isAdmin, perms };
}

// استبدال صلاحيات المستخدم بالكامل
export async function savePermissions(
  tx: Prisma.TransactionClient,
  userId: string,
  { isAdmin, perms }: ReturnType<typeof parsePermissions>,
) {
  await tx.user.update({ where: { id: userId }, data: { role: isAdmin ? "ADMIN" : "EMPLOYEE", department: null } });
  await tx.permission.deleteMany({ where: { userId } });
  if (!isAdmin && perms.length) await tx.permission.createMany({ data: perms.map((p) => ({ ...p, userId })) });
}

export const PERMISSION_SECTIONS = SECTIONS.map((s) => ({ department: s.department, title: s.title }));
