// إجراءات المعاملة: الأولوية، السرية، الاستلام بتعهد، التوزيع التلقائي، التأجيل، لفت النظر
import type { Prisma, PrismaClient, TxPriority } from "@prisma/client";
import { type CurrentUser, can } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { whatsappLink } from "@/lib/clients";

export const PRIORITY_LABELS: Record<TxPriority, string> = { NORMAL: "عادية", HIGH: "مهمة", URGENT: "عاجلة" };
export const PRIORITY_STYLES: Record<TxPriority, string> = {
  NORMAL: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  HIGH: "bg-amber-50 text-amber-800 ring-amber-200",
  URGENT: "bg-rose-50 text-rose-700 ring-rose-200",
};

// المعاملة السرية: للمسؤول عنها ومدير النظام فقط
export function visibleTxWhere(user: CurrentUser): Prisma.TransactionWhereInput {
  return user.isAdmin ? {} : { OR: [{ confidential: false }, { assigneeId: user.id }] };
}
export function canSeeTx(user: CurrentUser, tx: { confidential: boolean; assigneeId: string | null }) {
  return user.isAdmin || !tx.confidential || tx.assigneeId === user.id;
}

// بانتظار استلام المسؤول بتعهد (المعاملة الجارية فقط)
export function awaitingAcceptance(tx: { assigneeId: string | null; acceptedAt: Date | null; stage: { kind: string } }) {
  return !!tx.assigneeId && !tx.acceptedAt && tx.stage.kind === "OPEN";
}
export const awaitingAcceptanceWhere = (userId: string): Prisma.TransactionWhereInput => ({
  assigneeId: userId, acceptedAt: null, stage: { kind: "OPEN" },
});

// صلاحية الإسناد: الإدارة الكاملة، أو المسؤول الحالي (يحوّلها لزميل)
export function canAssign(user: CurrentUser, tx: { assigneeId: string | null }) {
  return can(user, "requests", "MANAGE") || (can(user, "requests", "EDIT") && (tx.assigneeId === user.id || !tx.assigneeId));
}

// المدير المباشر لموظف (عبر ملف الموظف) أو صاحب الإدارة الكاملة — ولا أحد يقرر لنفسه
export async function isManagerOf(db: PrismaClient, user: CurrentUser, otherUserId: string | null) {
  if (!otherUserId || otherUserId === user.id) return false;
  if (can(user, "requests", "MANAGE")) return true;
  if (!user.employeeId) return false;
  const emp = await db.employee.findUnique({ where: { userId: otherUserId }, select: { managerId: true } });
  return emp?.managerId === user.employeeId;
}

// طلبات التأجيل التي أستطيع البت فيها
export function decidableExtensionsWhere(user: CurrentUser): Prisma.ExtensionRequestWhereInput {
  const base: Prisma.ExtensionRequestWhereInput = { status: "PENDING", requestedById: { not: user.id } };
  if (can(user, "requests", "MANAGE")) return base;
  if (!user.employeeId) return { id: "__none__" };
  return { ...base, requestedBy: { employee: { managerId: user.employeeId } } };
}

// التوزيع التلقائي: الموظف المدرج الأقل معاملات جارية، ممن يتولّى هذه الخدمة (أو كل الخدمات)
export async function pickAssignee(db: PrismaClient, serviceTypeId: string | null) {
  const candidates = await db.user.findMany({
    where: {
      active: true,
      autoAssign: true,
      OR: [
        { assignableServices: { none: {} } },
        ...(serviceTypeId ? [{ assignableServices: { some: { id: serviceTypeId } } }] : []),
      ],
    },
    select: {
      id: true, name: true,
      _count: { select: { assignedTransactions: { where: { stage: { kind: "OPEN" } } } } },
    },
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a._count.assignedTransactions - b._count.assignedTransactions || a.name.localeCompare(b.name, "ar"));
  return candidates[0];
}

// نص الإقرار والتعهد (يُحفظ كما وافق عليه الموظف)
export function pledgeText(p: { name: string; jobTitle?: string | null; txNo: string; due: string }) {
  return [
    `أقرّ أنا ${p.name}${p.jobTitle ? ` (${p.jobTitle})` : ""} بأنني استلمت المعاملة رقم ${p.txNo} وكافة مستنداتها، وأتعهد بالآتي:`,
    `1. إنهاء المعاملة في موعد أقصاه ${p.due}، أو طلب تأجيله مسبقاً مع بيان السبب.`,
    "2. الحفاظ على سرية مستندات العميل وبياناته وسلامتها، وعدم إطلاع غير المختصين عليها.",
    "3. بذل أقصى جهد لإنهاء إجراءات المعاملة وإبلاغ العميل بما يُطلب منه في حينه.",
  ].join("\n");
}

// رسالة واتساب للعميل بتعليق خارجي على المعاملة
export function externalCommentWhatsapp(d: { phone?: string | null; clientName: string; txTitle: string; txNo: string; body: string }) {
  const base = whatsappLink(d.phone);
  if (!base) return null;
  const text = [
    "السلام عليكم ورحمة الله وبركاته،",
    `عميلنا العزيز ${d.clientName}،`,
    `بخصوص معاملة «${d.txTitle}» رقم ${d.txNo}:`,
    "",
    d.body,
    "",
    `مع تحيات فريق ${BRAND.company}`,
  ].join("\n");
  return `${base}?text=${encodeURIComponent(text)}`;
}
