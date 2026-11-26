// الأصول والعُهد: الترقيم، الحالات، ونص إقرار استلام العهدة
import type { AssetStatus, CustodyStatus } from "@prisma/client";

export const SECTION = "admin-affairs";
export const WARRANTY_SOON_DAYS = 60;

export function assetNumber(n: number) {
  return `AST-${String(n).padStart(4, "0")}`;
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  AVAILABLE: "متاح",
  IN_CUSTODY: "في عهدة موظف",
  MAINTENANCE: "في الصيانة",
  RETIRED: "مستبعد",
  LOST: "مفقود",
};
export const ASSET_STATUS_STYLES: Record<AssetStatus, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  IN_CUSTODY: "bg-sky-50 text-sky-700 ring-sky-200",
  MAINTENANCE: "bg-amber-50 text-amber-800 ring-amber-200",
  RETIRED: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  LOST: "bg-rose-50 text-rose-700 ring-rose-200",
};
export const CUSTODY_STATUS_LABELS: Record<CustodyStatus, string> = {
  PENDING: "بانتظار إقرار الموظف",
  ACTIVE: "عهدة قائمة",
  RETURNED: "أُعيدت",
};
export const CUSTODY_STATUS_STYLES: Record<CustodyStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  ACTIVE: "bg-sky-50 text-sky-700 ring-sky-200",
  RETURNED: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

// العهد غير المُعادة (تمنع إنهاء خدمة الموظف)
export const OPEN_CUSTODY = { status: { in: ["PENDING", "ACTIVE"] as CustodyStatus[] } };

// نص الإقرار (يُحفظ كما وافق عليه الموظف، ويُطبع في نموذج الاستلام)
export function custodyPledge(p: { employee: string; asset: string; number: string; serial?: string | null; condition?: string | null }) {
  return [
    `أقرّ أنا ${p.employee} بأنني استلمت ${p.asset} رقم ${p.number}${p.serial ? ` (الرقم التسلسلي: ${p.serial})` : ""}${p.condition ? ` بحالة: ${p.condition}` : ""}، عهدةً لديّ، وأتعهد بما يلي:`,
    "1. المحافظة عليه واستخدامه لأغراض العمل فقط.",
    "2. عدم تسليمه لغيري إلا بموافقة المنشأة.",
    "3. إبلاغ المنشأة فوراً عن أي عطل أو فقدان.",
    "4. إعادته بحالة سليمة عند طلبه أو عند انتهاء خدمتي، وتحمّل ما يترتب على التلف أو الفقد الناتج عن الإهمال وفق الأنظمة.",
  ].join("\n");
}
