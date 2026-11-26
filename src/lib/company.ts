import "server-only";
import { db } from "./db";

// بيانات المنشأة الرسمية (تظهر على عروض الأسعار والفواتير) — تُدخل من الإعدادات وتُحفظ في AppMeta
export type CompanyProfile = {
  legalName: string; // الاسم القانوني كما في شهادة الضريبة
  vatNumber: string; // 15 رقماً يبدأ وينتهي بـ 3
  crNumber: string; // الرقم الموحد للسجل التجاري
  address: string;
  phone: string;
  email: string;
  bankName: string;
  iban: string;
  quoteValidityDays: number; // صلاحية عرض السعر الافتراضية
  quoteTerms: string; // شروط افتراضية تظهر في عرض السعر
};

export const DEFAULT_PROFILE: CompanyProfile = {
  legalName: "", vatNumber: "", crNumber: "", address: "", phone: "", email: "", bankName: "", iban: "",
  quoteValidityDays: 10,
  quoteTerms: "الأسعار بالريال السعودي. الرسوم الحكومية تُسدَّد للجهات المختصة ولا تدخل ضمن هذا العرض.",
};
const KEY = "company-profile";

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const row = await db.appMeta.findUnique({ where: { key: KEY } });
  try { return row ? { ...DEFAULT_PROFILE, ...JSON.parse(row.value) } : DEFAULT_PROFILE; } catch { return DEFAULT_PROFILE; }
}
export async function saveCompanyProfile(p: CompanyProfile) {
  const value = JSON.stringify(p);
  await db.appMeta.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}
