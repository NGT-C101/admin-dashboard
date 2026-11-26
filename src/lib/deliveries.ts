// تسليم مخرجات المعاملات للعميل: التسميات، الترقيم، ورسالة واتساب
import type { DeliveryChannel, DocType, Prisma } from "@prisma/client";
import { BRAND } from "@/lib/brand";
import { whatsappLink } from "@/lib/clients";
import { DOC_TYPE_LABELS } from "@/lib/documents";
import { txNumber } from "@/lib/format";

export function deliveryNumber(n: number) {
  return `DL-${String(n).padStart(4, "0")}`;
}

export const CHANNEL_LABELS: Record<DeliveryChannel, string> = {
  HAND: "تسليم باليد",
  WHATSAPP: "واتساب",
  EMAIL: "البريد الإلكتروني",
  COURIER: "مندوب / شحن",
  PLATFORM: "عبر المنصة الحكومية",
  OTHER: "طريقة أخرى",
};

export const CHANNEL_STYLES: Record<DeliveryChannel, string> = {
  HAND: "bg-sky-50 text-sky-700 ring-sky-200",
  WHATSAPP: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  EMAIL: "bg-violet-50 text-violet-700 ring-violet-200",
  COURIER: "bg-amber-50 text-amber-800 ring-amber-200",
  PLATFORM: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  OTHER: "bg-neutral-100 text-neutral-700 ring-neutral-200",
};

// معاملة في مرحلة «جاهزة للتسليم» (مثل: صدرت / معتمدة) ولم تُغلق بعد
export const awaitingDeliveryWhere = {
  stage: { readyForDelivery: true, kind: { not: "CANCELLED" } },
} satisfies Prisma.TransactionWhereInput;

// البنود الورقية: بند في كل سطر
export function itemLines(items?: string | null) {
  return (items ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
}

// رسالة واتساب جاهزة بالفصحى + رابط wa.me (الملفات تُرفق يدوياً في المحادثة)
export function deliveryWhatsapp(d: {
  phone?: string | null;
  clientName: string;
  companyName?: string | null;
  txTitle: string;
  txNo: number;
  note?: string | null;
  documents: { type: DocType; title: string | null }[];
  items?: string | null;
}) {
  const base = whatsappLink(d.phone);
  if (!base) return null;
  const outputs = [
    ...d.documents.map((x) => x.title ? `${DOC_TYPE_LABELS[x.type]}: ${x.title}` : DOC_TYPE_LABELS[x.type]),
    ...itemLines(d.items),
  ];
  const lines = [
    "السلام عليكم ورحمة الله وبركاته،",
    `عميلنا العزيز ${d.clientName}،`,
    `يسعدنا إبلاغكم بإنجاز معاملة «${d.txTitle}» رقم ${txNumber(d.txNo)}${d.companyName ? ` الخاصة بـ ${d.companyName}` : ""}.`,
    ...(d.note ? ["", d.note] : []),
    ...(outputs.length ? ["", "المخرجات:", ...outputs.map((o) => `- ${o}`)] : []),
    "",
    `مع تحيات فريق ${BRAND.company}`,
  ];
  return `${base}?text=${encodeURIComponent(lines.join("\n"))}`;
}
