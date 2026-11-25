"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { can, requireAdmin, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalDate, optionalMoney, optionalText, tenDigits, uniqueError } from "@/lib/forms";
import { isValidSaudiIban, normalizeIban } from "@/lib/hr";
import { parsePermissions, savePermissions } from "@/lib/permissions";

const phoneOk = (v: string | null) => v === null || /^(05\d{8}|\+?\d{9,15})$/.test(v.replace(/\s/g, ""));
const emailOk = (v: string | null) => v === null || z.string().email().safeParse(v).success;

const baseSchema = z.object({
  fullName: z.string().trim().min(3, "يرجى إدخال الاسم الكامل"),
  fullNameEn: optionalText,
  gender: z.enum(["MALE", "FEMALE"]).or(z.literal("")).transform((v) => (v === "" ? null : v)).optional(),
  birthDate: optionalDate,
  maritalStatus: optionalText,
  nationality: optionalText,
  nationalId: tenDigits("رقم الهوية / الإقامة", "12"),
  idExpiry: optionalDate,
  passportNumber: optionalText,
  passportExpiry: optionalDate,
  phone: optionalText.refine(phoneOk, { message: "رقم الجوال غير صحيح" }),
  personalEmail: optionalText.refine(emailOk, { message: "البريد الشخصي غير صحيح" }),
  city: optionalText,
  address: optionalText,
  emergencyName: optionalText,
  emergencyRelation: optionalText,
  emergencyPhone: optionalText.refine(phoneOk, { message: "رقم جوال الطوارئ غير صحيح" }),
  jobTitle: z.string().trim().min(2, "يرجى إدخال المسمى الوظيفي"),
  orgDepartment: optionalText,
  managerId: optionalText,
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "TEMPORARY", "TRAINEE"]),
  hireDate: z.string().min(1, "يرجى تحديد تاريخ الالتحاق").transform((v) => new Date(v)),
  probationEnd: optionalDate,
  contractEnd: optionalDate,
  workLocation: optionalText,
  notes: optionalText,
});

const salarySchema = z.object({
  basicSalary: optionalMoney,
  housingAllowance: optionalMoney,
  transportAllowance: optionalMoney,
  otherAllowances: optionalMoney,
  bankName: optionalText,
  iban: optionalText.transform((v) => (v ? normalizeIban(v) : v)).refine((v) => v === null || isValidSaudiIban(v), {
    message: "رقم الآيبان غير صحيح (يجب أن يبدأ بـ SA ويتكون من 24 خانة)",
  }),
  gosiRegistered: z.string().optional().transform((v) => v === "on"),
});

const loginSchema = z.object({
  loginEmail: z.string().trim().toLowerCase().email("البريد الإلكتروني لحساب الدخول غير صحيح"),
  loginPassword: z.string().min(10, "يجب ألا تقل كلمة المرور المؤقتة عن 10 أحرف"),
});

const UNIQUE = { nationalId: "رقم الهوية / الإقامة", email: "البريد الإلكتروني", userId: "حساب الدخول" };

// المدير المباشر مينفعش يكون الموظف نفسه أو حد تحته في الهيكل
async function managerCreatesCycle(employeeId: string, managerId: string | null) {
  let cur = managerId;
  for (let i = 0; cur && i < 50; i++) {
    if (cur === employeeId) return true;
    cur = (await db.employee.findUnique({ where: { id: cur }, select: { managerId: true } }))?.managerId ?? null;
  }
  return false;
}

export async function createEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSection("employees", "EDIT");
  const raw = Object.fromEntries(formData);
  const base = baseSchema.safeParse(raw);
  if (!base.success) return { error: firstError(base.error) };
  const salary = can(user, "employees", "MANAGE") ? salarySchema.safeParse(raw) : null;
  if (salary && !salary.success) return { error: firstError(salary.error) };

  const wantsLogin = user.isAdmin && formData.get("createLogin") === "on";
  const login = wantsLogin ? loginSchema.safeParse(raw) : null;
  if (login && !login.success) return { error: firstError(login.error) };
  if (login?.success && (await db.user.findUnique({ where: { email: login.data.loginEmail } }))) {
    return { error: "البريد الإلكتروني لحساب الدخول مستخدم مسبقاً" };
  }

  let id = "";
  try {
    await db.$transaction(async (tx) => {
      let userId: string | null = null;
      if (login?.success) {
        const u = await tx.user.create({
          data: {
            name: base.data.fullName, email: login.data.loginEmail,
            passwordHash: await bcrypt.hash(login.data.loginPassword, 10), mustChangePassword: true,
          },
        });
        await savePermissions(tx, u.id, parsePermissions(formData));
        userId = u.id;
      }
      const e = await tx.employee.create({ data: { ...base.data, ...(salary?.success ? salary.data : {}), userId } });
      id = e.id;
    });
  } catch (e) {
    return { error: uniqueError(e, UNIQUE) ?? "حدث خطأ، يرجى المحاولة مرة أخرى" };
  }
  redirect(`/employees/profiles/${id}`);
}

export async function updateEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("employees", "EDIT");
  const id = String(formData.get("id"));
  const raw = Object.fromEntries(formData);
  const base = baseSchema.safeParse(raw);
  if (!base.success) return { error: firstError(base.error) };
  if (await managerCreatesCycle(id, base.data.managerId)) return { error: "لا يمكن أن يكون المدير المباشر هو الموظف نفسه أو أحد مرؤوسيه" };
  try {
    const emp = await db.employee.update({ where: { id }, data: base.data });
    if (emp.userId) await db.user.update({ where: { id: emp.userId }, data: { name: emp.fullName } });
  } catch (e) {
    return { error: uniqueError(e, UNIQUE) ?? "حدث خطأ، يرجى المحاولة مرة أخرى" };
  }
  revalidatePath(`/employees/profiles/${id}`);
  return { success: "تم حفظ التعديلات" };
}

export async function updateSalary(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("employees", "MANAGE");
  const id = String(formData.get("id"));
  const parsed = salarySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await db.employee.update({ where: { id }, data: parsed.data });
  revalidatePath(`/employees/profiles/${id}`);
  return { success: "تم حفظ بيانات الراتب" };
}

export async function setEmployeeStatus(formData: FormData) {
  await requireSection("employees", "EDIT");
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["ACTIVE", "ON_LEAVE", "SUSPENDED"].includes(status)) return;
  const emp = await db.employee.findUnique({ where: { id } });
  if (!emp || emp.status === "TERMINATED") return;
  await db.employee.update({ where: { id }, data: { status: status as never } });
  revalidatePath(`/employees/profiles/${id}`);
  revalidatePath("/employees/profiles");
}

const terminateSchema = z.object({
  terminationDate: z.string().min(1, "يرجى تحديد تاريخ انتهاء الخدمة").transform((v) => new Date(v)),
  terminationReason: z.enum(["RESIGNATION", "TERMINATION", "CONTRACT_END"], { message: "يرجى تحديد سبب انتهاء الخدمة" }),
});

// إنهاء الخدمة: حساب الدخول بيتوقف تلقائياً
export async function terminateEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("employees", "MANAGE");
  const id = String(formData.get("id"));
  const parsed = terminateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const emp = await db.employee.update({ where: { id }, data: { ...parsed.data, status: "TERMINATED" } });
  if (emp.userId) await db.user.update({ where: { id: emp.userId }, data: { active: false } });
  revalidatePath(`/employees/profiles/${id}`);
  revalidatePath("/employees/profiles");
  return { success: "تم تسجيل انتهاء الخدمة وإيقاف حساب الدخول" };
}

export async function reinstateEmployee(formData: FormData) {
  await requireSection("employees", "MANAGE");
  const id = String(formData.get("id"));
  const emp = await db.employee.update({ where: { id }, data: { status: "ACTIVE", terminationDate: null, terminationReason: null } });
  if (emp.userId) await db.user.update({ where: { id: emp.userId }, data: { active: true } });
  revalidatePath(`/employees/profiles/${id}`);
  revalidatePath("/employees/profiles");
}

// منح حساب دخول لموظف مسجّل بالفعل (لمدير النظام فقط)
export async function grantLogin(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(formData.get("id"));
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const emp = await db.employee.findUnique({ where: { id } });
  if (!emp) return { error: "غير موجود" };
  if (emp.userId) return { error: "لدى الموظف حساب دخول بالفعل" };
  if (await db.user.findUnique({ where: { email: parsed.data.loginEmail } })) return { error: "البريد الإلكتروني مستخدم مسبقاً" };
  await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { name: emp.fullName, email: parsed.data.loginEmail, passwordHash: await bcrypt.hash(parsed.data.loginPassword, 10), mustChangePassword: true },
    });
    await savePermissions(tx, u.id, parsePermissions(formData));
    await tx.employee.update({ where: { id }, data: { userId: u.id } });
  });
  revalidatePath(`/employees/profiles/${id}`);
  return { success: "تم إنشاء حساب الدخول ✅" };
}
