// منطق الموارد البشرية: التسميات، مدة الخدمة، مكافأة نهاية الخدمة، التحقق من الآيبان
import type { EmployeeStatus, EmploymentType, Gender, PermLevel } from "@prisma/client";

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: "على رأس العمل",
  ON_LEAVE: "في إجازة",
  SUSPENDED: "موقوف",
  TERMINATED: "منتهية خدمته",
};
export const EMPLOYEE_STATUS_STYLES: Record<EmployeeStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ON_LEAVE: "bg-sky-50 text-sky-700 ring-sky-200",
  SUSPENDED: "bg-amber-50 text-amber-700 ring-amber-200",
  TERMINATED: "bg-neutral-100 text-neutral-500 ring-neutral-200",
};
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "دوام كامل",
  PART_TIME: "دوام جزئي",
  TEMPORARY: "عقد مؤقت",
  TRAINEE: "متدرب",
};
export const GENDER_LABELS: Record<Gender, string> = { MALE: "ذكر", FEMALE: "أنثى" };
export const TERMINATION_REASONS = {
  RESIGNATION: "استقالة",
  TERMINATION: "إنهاء من صاحب العمل",
  CONTRACT_END: "انتهاء مدة العقد",
} as const;
export type TerminationReason = keyof typeof TERMINATION_REASONS;

export const ORG_DEPARTMENTS = [
  "الإدارة العليا", "الموارد البشرية", "خدمة العملاء", "المعاملات الحكومية", "الشؤون الإدارية",
  "الحسابات", "العلاقات العامة", "التسويق والإعلام", "تقنية المعلومات",
];
export const MARITAL_STATUSES = ["أعزب", "متزوج", "مطلق", "أرمل"];

export const PERM_LEVEL_LABELS: Record<PermLevel | "NONE", string> = {
  NONE: "بدون",
  VIEW: "عرض فقط",
  EDIT: "إضافة وتعديل",
  MANAGE: "إدارة كاملة",
};

// صيغة العدد مع التمييز حسب قواعد العربية: [مفرد، مثنى، جمع (3-10)، تمييز (11+)]
export function countText(n: number, [one, two, few, many]: [string, string, string, string]) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}
const YEARS: [string, string, string, string] = ["سنة واحدة", "سنتان", "سنوات", "سنة"];
const MONTHS: [string, string, string, string] = ["شهر واحد", "شهران", "أشهر", "شهراً"];

// مدة الخدمة بالسنوات والأشهر
export function serviceParts(from: Date, to: Date = new Date()) {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months--;
  months = Math.max(0, months);
  return { years: Math.floor(months / 12), months: months % 12, totalYears: Math.max(0, (to.getTime() - from.getTime()) / (365.25 * 86400000)) };
}
export function serviceText(from: Date, to?: Date) {
  const { years, months } = serviceParts(from, to);
  const parts = [years ? countText(years, YEARS) : "", months ? countText(months, MONTHS) : ""].filter(Boolean);
  if (!parts.length) return "أقل من شهر";
  // "و" قبل رقم بتتعرض بشكل غلط في المتصفح، فبنفصلها بمسافة
  return parts.reduce((acc, p) => (acc ? `${acc} و${/^\d/.test(p) ? " " : ""}${p}` : p), "");
}

type Money = { toString(): string } | null | undefined;
const n = (v: Money) => (v === null || v === undefined ? 0 : Number(v.toString()));

export function totalWage(e: { basicSalary: Money; housingAllowance: Money; transportAllowance: Money; otherAllowances: Money }) {
  return n(e.basicSalary) + n(e.housingAllowance) + n(e.transportAllowance) + n(e.otherAllowances);
}

// مكافأة نهاية الخدمة (نظام العمل السعودي — المادتان 84 و85) — تقديرية
// نصف أجر شهر عن كل سنة من أول 5 سنوات، وأجر شهر كامل عن كل سنة بعدها
// في الاستقالة: أقل من سنتين لا شيء، 2-5 ثلث المكافأة، 5-10 ثلثاها، 10 فأكثر كاملة
export function endOfServiceBenefit(wage: number, years: number, reason: TerminationReason = "TERMINATION") {
  const full = Math.min(years, 5) * wage * 0.5 + Math.max(0, years - 5) * wage;
  let factor = 1;
  if (reason === "RESIGNATION") factor = years < 2 ? 0 : years < 5 ? 1 / 3 : years < 10 ? 2 / 3 : 1;
  return { full: Math.round(full * 100) / 100, payable: Math.round(full * factor * 100) / 100, factor };
}

// آيبان سعودي: SA + 22 رقم، مع التحقق من رقم المراجعة (mod 97)
export function normalizeIban(v: string) {
  return v.replace(/\s/g, "").toUpperCase();
}
export function isValidSaudiIban(v: string) {
  const iban = normalizeIban(v);
  if (!/^SA\d{22}$/.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
  return rem === 1;
}
export function formatIban(v?: string | null) {
  return v ? normalizeIban(v).replace(/(.{4})/g, "$1 ").trim() : "";
}

// الأحرف الأولى للصورة الرمزية
export function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "");
}
