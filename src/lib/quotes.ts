import type { QuoteStatus } from "@prisma/client";
import { riyadhToday } from "./time";

// عروض الأسعار: التسميات والحالات والحسابات

export function quoteNumber(n: number) {
  return `QT-${String(n).padStart(4, "0")}`;
}

// الحالة الظاهرة: المسودة أو المرسل بعد تاريخ الصلاحية = منتهي
export type QuoteView = QuoteStatus | "EXPIRED";
export function quoteView(q: { status: QuoteStatus; validUntil: Date }): QuoteView {
  return (q.status === "DRAFT" || q.status === "SENT") && q.validUntil < riyadhToday() ? "EXPIRED" : q.status;
}

export const QUOTE_STATUS_LABELS: Record<QuoteView, string> = {
  DRAFT: "مسودة",
  SENT: "مُرسل للعميل",
  ACCEPTED: "مقبول",
  REJECTED: "مرفوض",
  CANCELLED: "ملغى",
  EXPIRED: "منتهي الصلاحية",
};
export const QUOTE_STATUS_STYLES: Record<QuoteView, string> = {
  DRAFT: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  SENT: "bg-sky-50 text-sky-700 ring-sky-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
  CANCELLED: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  EXPIRED: "bg-amber-50 text-amber-800 ring-amber-200",
};

// يمكن تعديله ما دام لم يُحسم
export const isEditable = (s: QuoteStatus) => s === "DRAFT" || s === "SENT";

export const PAYMENT_TERMS = ["دفعة واحدة مقدماً", "دفعة واحدة عند التسليم", "50% مقدماً و50% عند التسليم", "أقساط", "اشتراك شهري"];

// الحساب بالهللات لتفادي أخطاء الكسور العشرية
export type Line = { quantity: number; unitPrice: number };
const halalas = (v: number) => Math.round(v * 100);
export function lineTotal(l: Line) {
  return Math.round(l.quantity * halalas(l.unitPrice)) / 100;
}
export function quoteTotals(lines: Line[], vatRate = 15) {
  const sub = lines.reduce((s, l) => s + halalas(lineTotal(l)), 0);
  const vat = Math.round((sub * vatRate) / 100);
  return { subtotal: sub / 100, vatAmount: vat / 100, total: (sub + vat) / 100 };
}
