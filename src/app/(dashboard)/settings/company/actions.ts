"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { saveCompanyProfile } from "@/lib/company";
import { type FormState, firstError } from "@/lib/forms";
import { isValidSaudiIban, normalizeIban } from "@/lib/hr";

const text = z.string().trim().default("");
const schema = z.object({
  legalName: z.string().trim().min(3, "يرجى إدخال الاسم القانوني للمنشأة كما في شهادة التسجيل الضريبي"),
  vatNumber: z.string().trim().regex(/^3\d{13}3$/, "يجب أن يتكون الرقم الضريبي من 15 رقماً ويبدأ وينتهي بـ 3"),
  crNumber: z.string().trim().regex(/^\d{10}$/, "يجب أن يتكون الرقم الموحد للسجل التجاري من 10 أرقام"),
  address: z.string().trim().min(5, "يرجى إدخال العنوان الوطني للمنشأة"),
  phone: text,
  email: z.string().trim().refine((v) => v === "" || /^\S+@\S+\.\S+$/.test(v), "البريد الإلكتروني غير صحيح").default(""),
  bankName: text,
  iban: z.string().trim().default("").refine((v) => v === "" || isValidSaudiIban(v), "رقم الآيبان غير صحيح").transform((v) => (v ? normalizeIban(v) : "")),
  quoteValidityDays: z.coerce.number().int("يرجى إدخال عدد أيام صحيح").min(1, "أقل صلاحية يوم واحد").max(90, "أقصى صلاحية 90 يوماً"),
  quoteTerms: text,
});

export async function saveCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await saveCompanyProfile(parsed.data);
  revalidatePath("/settings/company");
  return { success: "تم حفظ بيانات المنشأة" };
}
