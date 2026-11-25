"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalDate, optionalText, tenDigits, uniqueError } from "@/lib/forms";

const clientSchema = z.object({
  name: z.string().trim().min(2, "اكتب اسم العميل"),
  nationalId: tenDigits("رقم الهوية / الإقامة", "12"),
  phone: optionalText.refine((v) => v === null || /^(05\d{8}|\+?\d{9,15})$/.test(v.replace(/\s/g, "")), {
    message: "رقم الجوال غير صحيح (مثال: 0551234567)",
  }),
  email: optionalText.refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: "الإيميل غير صحيح",
  }),
  nationality: optionalText,
  notes: optionalText,
});

const companySchema = z.object({
  clientId: z.string().min(1, "اختار العميل المالك"),
  name: z.string().trim().min(2, "اكتب اسم الشركة"),
  crNumber: tenDigits("رقم السجل التجاري"),
  unifiedNumber: tenDigits("الرقم الموحد", "7"),
  legalForm: optionalText,
  city: optionalText,
  activity: optionalText,
  crExpiry: optionalDate,
  notes: optionalText,
});

const CLIENT_UNIQUE = { nationalId: "رقم الهوية" };
const COMPANY_UNIQUE = { crNumber: "رقم السجل التجاري", unifiedNumber: "الرقم الموحد" };

export async function createClient(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("clients");
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  let id: string;
  try {
    id = (await db.client.create({ data: parsed.data })).id;
  } catch (e) {
    return { error: uniqueError(e, CLIENT_UNIQUE) ?? "حصل خطأ، حاول تاني" };
  }
  redirect(`/clients/directory/${id}`);
}

export async function updateClient(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("clients");
  const id = String(formData.get("id"));
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await db.client.update({ where: { id }, data: parsed.data });
  } catch (e) {
    return { error: uniqueError(e, CLIENT_UNIQUE) ?? "حصل خطأ، حاول تاني" };
  }
  revalidatePath(`/clients/directory/${id}`);
  return { success: "تم حفظ التعديلات" };
}

export async function createCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("clients");
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  let id: string;
  try {
    id = (await db.company.create({ data: parsed.data })).id;
  } catch (e) {
    return { error: uniqueError(e, COMPANY_UNIQUE) ?? "حصل خطأ، حاول تاني" };
  }
  redirect(`/clients/companies/${id}`);
}

export async function updateCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("clients");
  const id = String(formData.get("id"));
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await db.company.update({ where: { id }, data: parsed.data });
  } catch (e) {
    return { error: uniqueError(e, COMPANY_UNIQUE) ?? "حصل خطأ، حاول تاني" };
  }
  revalidatePath(`/clients/companies/${id}`);
  return { success: "تم حفظ التعديلات" };
}
