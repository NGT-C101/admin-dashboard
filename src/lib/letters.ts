// الصادر والوارد: الترقيم السنوي، الحالات، وصلاحيات المراجعة والاعتماد
import type { LetterDirection, LetterStatus, Prisma, PrismaClient } from "@prisma/client";
import { type CurrentUser, can } from "@/lib/auth";

export const SECTION = "admin-affairs";

// ص-2026-0001 / و-2026-0001 (الصادر يُرقَّم عند الاعتماد فقط)
export function letterNumber(l: { direction: LetterDirection; year: number | null; seq: number | null }) {
  if (!l.year || !l.seq) return null;
  return `${l.direction === "OUTGOING" ? "ص" : "و"}-${l.year}-${String(l.seq).padStart(4, "0")}`;
}

export const STATUS_LABELS: Record<LetterStatus, string> = {
  DRAFT: "مسودة",
  IN_REVIEW: "بانتظار المراجعة",
  REVIEWED: "بانتظار الاعتماد",
  RETURNED: "أُعيد للتعديل",
  APPROVED: "معتمد",
  RECEIVED: "وارد مسجّل",
  CANCELLED: "ملغى",
};
export const STATUS_STYLES: Record<LetterStatus, string> = {
  DRAFT: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  IN_REVIEW: "bg-amber-50 text-amber-800 ring-amber-200",
  REVIEWED: "bg-sky-50 text-sky-700 ring-sky-200",
  RETURNED: "bg-orange-50 text-orange-700 ring-orange-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  RECEIVED: "bg-violet-50 text-violet-700 ring-violet-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
};

type L = { createdById: string; status: LetterStatus; direction: LetterDirection };

// المدير المباشر لكاتب الخطاب (عبر ملف الموظف)
export async function isDirectManager(db: PrismaClient, user: CurrentUser, otherUserId: string) {
  if (!user.employeeId || otherUserId === user.id) return false;
  const emp = await db.employee.findUnique({ where: { userId: otherUserId }, select: { managerId: true } });
  return emp?.managerId === user.employeeId;
}

// لا أحد يراجع أو يعتمد خطابه بنفسه، باستثناء مدير النظام
const notSelf = (user: CurrentUser, l: L) => user.isAdmin || l.createdById !== user.id;

// المراجعة (التصديق): المدير المباشر للكاتب، أو صاحب الإدارة الكاملة على الشؤون الإدارية
export async function canReview(db: PrismaClient, user: CurrentUser, l: L) {
  if (l.direction !== "OUTGOING" || l.status !== "IN_REVIEW" || !notSelf(user, l)) return false;
  return can(user, SECTION, "MANAGE") || isDirectManager(db, user, l.createdById);
}
// الاعتماد: صاحب الإدارة الكاملة على الشؤون الإدارية أو مدير النظام
export function canApprove(user: CurrentUser, l: L) {
  return l.direction === "OUTGOING" && l.status === "REVIEWED" && notSelf(user, l) && can(user, SECTION, "MANAGE");
}
export function canEditLetter(user: CurrentUser, l: L) {
  return l.direction === "OUTGOING" && (l.status === "DRAFT" || l.status === "RETURNED")
    && (l.createdById === user.id || can(user, SECTION, "MANAGE"));
}

// الخطابات التي تنتظر إجرائي (مراجعة أو اعتماد)
export function myQueueWhere(user: CurrentUser): Prisma.LetterWhereInput {
  const others: Prisma.LetterWhereInput = user.isAdmin ? {} : { createdById: { not: user.id } };
  const or: Prisma.LetterWhereInput[] = [];
  if (can(user, SECTION, "MANAGE")) or.push({ status: { in: ["IN_REVIEW", "REVIEWED"] } });
  else if (user.employeeId) or.push({ status: "IN_REVIEW", createdBy: { employee: { managerId: user.employeeId } } });
  if (or.length === 0) return { id: "__none__" };
  return { direction: "OUTGOING", ...others, OR: or };
}

// الرقم التالي في السنة (داخل معاملة قاعدة البيانات)
export async function nextSeq(tx: Prisma.TransactionClient, direction: LetterDirection, year: number) {
  const last = await tx.letter.aggregate({ where: { direction, year }, _max: { seq: true } });
  return (last._max.seq ?? 0) + 1;
}

// رابط صفحة التحقق العامة لرمز QR (من عنوان الطلب الحالي: platform.ngt.sa في الإنتاج)
export async function verifyUrl(token: string) {
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/verify/${token}`;
}
export async function qrSvg(text: string) {
  const QR = (await import("qrcode")).default;
  return QR.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0B1733", light: "#FFFFFF" } });
}
