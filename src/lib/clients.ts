// تسميات ودوال مساعدة لقسم العملاء
import type { ClientStatus, ContractType, InteractionType } from "@prisma/client";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  LEAD: "عميل محتمل",
  ACTIVE: "نشط",
  INACTIVE: "متوقف",
};
export const CLIENT_STATUS_STYLES: Record<ClientStatus, string> = {
  LEAD: "bg-amber-50 text-amber-700 ring-amber-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INACTIVE: "bg-neutral-100 text-neutral-500 ring-neutral-200",
};

export const CLIENT_SOURCES = ["توصية من عميل", "وسائل التواصل الاجتماعي", "إعلان", "موقع إلكتروني", "زيارة مباشرة", "معرفة شخصية", "أخرى"];

export const NITAQAT_OPTIONS = ["بلاتيني", "أخضر مرتفع", "أخضر متوسط", "أخضر منخفض", "أصفر", "أحمر", "غير مصنّف"];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  ONE_TIME: "خدمة واحدة",
  MONTHLY: "باقة شهرية",
  ANNUAL: "سنوي",
};

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  CALL: "مكالمة",
  WHATSAPP: "واتساب",
  MEETING: "اجتماع",
  VISIT: "زيارة",
  EMAIL: "بريد إلكتروني",
  OTHER: "أخرى",
};

export const DAY = 86400000;

export function daysUntil(d: Date) {
  return Math.ceil((d.getTime() - Date.now()) / DAY);
}

export function inDays(n: number) {
  return new Date(Date.now() + n * DAY);
}

export function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// حالة العقد
export type ContractState = "active" | "ending" | "expired" | "cancelled" | "upcoming";
export const CONTRACT_STATE_LABELS: Record<ContractState, string> = {
  active: "ساري",
  ending: "ينتهي قريباً",
  expired: "منتهي",
  cancelled: "ملغي",
  upcoming: "لم يبدأ",
};
export const CONTRACT_STATE_STYLES: Record<ContractState, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ending: "bg-amber-50 text-amber-700 ring-amber-200",
  expired: "bg-rose-50 text-rose-700 ring-rose-200",
  cancelled: "bg-neutral-100 text-neutral-500 ring-neutral-200",
  upcoming: "bg-sky-50 text-sky-700 ring-sky-200",
};
export function contractState(c: { startDate: Date; endDate: Date | null; cancelledAt: Date | null }): ContractState {
  if (c.cancelledAt) return "cancelled";
  if (c.startDate.getTime() > Date.now()) return "upcoming";
  if (!c.endDate) return "active";
  const d = daysUntil(c.endDate);
  return d < 0 ? "expired" : d <= 30 ? "ending" : "active";
}

// نسبة السعودة
export function saudizationRate(saudi?: number | null, nonSaudi?: number | null) {
  const total = (saudi ?? 0) + (nonSaudi ?? 0);
  return total > 0 ? Math.round(((saudi ?? 0) / total) * 100) : null;
}

// رابط واتساب من رقم سعودي (05xxxxxxxx أو 9665xxxxxxxx)
export function whatsappLink(phone?: string | null) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("05") && d.length === 10) d = "966" + d.slice(1);
  if (d.startsWith("5") && d.length === 9) d = "966" + d;
  return d.length >= 9 ? `https://wa.me/${d}` : null;
}

// صيغة العدد مع "يوم" حسب قواعد العربية
export function daysText(n: number) {
  n = Math.abs(n);
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومان";
  if (n >= 3 && n <= 10) return `${n} أيام`;
  return `${n} يوماً`;
}
