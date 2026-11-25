"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalDate, optionalInt, optionalText, tenDigits, uniqueError } from "@/lib/forms";

// رقم الجوال (ممكن يكون مكتوب بمسافات)
const phoneOk = (v: string | null) => v === null || /^(05\d{8}|\+?\d{9,15})$/.test(v.replace(/\s/g, ""));

const clientSchema = z.object({
  name: z.string().trim().min(2, "يرجى إدخال اسم العميل"),
  nationalId: tenDigits("رقم الهوية / الإقامة", "12"),
  phone: optionalText.refine(phoneOk, { message: "رقم الجوال غير صحيح (مثال: 0551234567)" }),
  email: optionalText.refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: "البريد الإلكتروني غير صحيح",
  }),
  phone2: optionalText.refine(phoneOk, { message: "رقم الجوال الآخر غير صحيح" }),
  nationality: optionalText,
  city: optionalText,
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).default("ACTIVE"),
  vip: z.string().optional().transform((v) => v === "on"),
  source: optionalText,
  accountManagerId: optionalText,
  notes: optionalText,
});

const companySchema = z.object({
  clientId: z.string().min(1, "يرجى اختيار العميل المالك"),
  name: z.string().trim().min(2, "يرجى إدخال اسم الشركة"),
  crNumber: tenDigits("رقم السجل التجاري"),
  unifiedNumber: tenDigits("الرقم الموحد", "7"),
  legalForm: optionalText,
  city: optionalText,
  activity: optionalText,
  crExpiry: optionalDate,
  vatNumber: optionalText.refine((v) => v === null || /^3\d{13}3$/.test(v), {
    message: "يجب أن يتكون الرقم الضريبي من 15 رقماً ويبدأ وينتهي بالرقم 3",
  }),
  nationalAddress: optionalText
    .transform((v) => (v ? v.toUpperCase() : v))
    .refine((v) => v === null || /^[A-Z]{4}\d{4}$/.test(v), {
      message: "العنوان الوطني المختصر: 4 أحرف إنجليزية و4 أرقام (مثال: RRRD2929)",
    }),
  molFileNumber: optionalText,
  gosiNumber: optionalText,
  nitaqat: optionalText,
  saudiCount: optionalInt,
  nonSaudiCount: optionalInt,
  notes: optionalText,
});

const CLIENT_UNIQUE = { nationalId: "رقم الهوية" };
const COMPANY_UNIQUE = { crNumber: "رقم السجل التجاري", unifiedNumber: "الرقم الموحد" };


const quickCompanySchema = z
  .object({ companyName: optionalText, companyCr: tenDigits("رقم السجل التجاري") })
  .refine((d) => !d.companyCr || d.companyName, { message: "يرجى إدخال اسم الشركة مع السجل التجاري" });

export async function createClient(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("clients", "EDIT");
  const raw = Object.fromEntries(formData);
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const company = quickCompanySchema.safeParse(raw);
  if (!company.success) return { error: firstError(company.error) };
  const { companyName, companyCr } = company.data;

  let id: string;
  try {
    id = (await db.client.create({
      data: {
        ...parsed.data,
        ...(companyName ? { companies: { create: { name: companyName, crNumber: companyCr } } } : {}),
      },
    })).id;
  } catch (e) {
    return { error: uniqueError(e, { ...CLIENT_UNIQUE, ...COMPANY_UNIQUE }) ?? "حدث خطأ، يرجى المحاولة مرة أخرى" };
  }
  redirect(`/clients/directory/${id}`);
}

export async function updateClient(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("clients", "EDIT");
  const id = String(formData.get("id"));
  const parsed = clientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await db.client.update({ where: { id }, data: parsed.data });
  } catch (e) {
    return { error: uniqueError(e, CLIENT_UNIQUE) ?? "حدث خطأ، يرجى المحاولة مرة أخرى" };
  }
  revalidatePath(`/clients/directory/${id}`);
  return { success: "تم حفظ التعديلات" };
}

export async function createCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("clients", "EDIT");
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  let id: string;
  try {
    id = (await db.company.create({ data: parsed.data })).id;
  } catch (e) {
    return { error: uniqueError(e, COMPANY_UNIQUE) ?? "حدث خطأ، يرجى المحاولة مرة أخرى" };
  }
  redirect(`/clients/companies/${id}`);
}

export async function updateCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("clients", "EDIT");
  const id = String(formData.get("id"));
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await db.company.update({ where: { id }, data: parsed.data });
  } catch (e) {
    return { error: uniqueError(e, COMPANY_UNIQUE) ?? "حدث خطأ، يرجى المحاولة مرة أخرى" };
  }
  revalidatePath(`/clients/companies/${id}`);
  return { success: "تم حفظ التعديلات" };
}

// أرشفة العميل (للمدير ومدير القسم): بيختفي من القوايم والتنبيهات من غير ما يتمسح
export async function toggleArchiveClient(formData: FormData) {
  const user = await requireSection("clients", "MANAGE");
  const id = String(formData.get("id"));
  const c = await db.client.findUnique({ where: { id } });
  if (!c) return;
  await db.client.update({ where: { id }, data: { archivedAt: c.archivedAt ? null : new Date() } });
  revalidatePath(`/clients/directory/${id}`);
  revalidatePath("/clients/directory");
  revalidatePath("/clients/alerts");
}
