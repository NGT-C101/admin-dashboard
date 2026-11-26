// المشتريات: الترقيم، الحالات، ودورة الموافقة (المدير المباشر ثم الشؤون الإدارية)
import type { Prisma, PrismaClient, PurchaseStatus } from "@prisma/client";
import { type CurrentUser, can } from "@/lib/auth";
import { isDirectManager } from "@/lib/letters";

export const SECTION = "admin-affairs";
export const MAX_ITEMS = 30;
export const MAX_ASSET_UNITS = 50; // أقصى عدد أصول تُنشأ من بند واحد

export function purchaseNumber(n: number) {
  return `PUR-${String(n).padStart(4, "0")}`;
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  PENDING_MANAGER: "بانتظار المدير المباشر",
  PENDING_APPROVAL: "بانتظار اعتماد الشؤون الإدارية",
  APPROVED: "معتمد — جاهز للشراء",
  RECEIVED: "تم الشراء والاستلام",
  REJECTED: "مرفوض",
  CANCELLED: "ملغى",
};
export const PURCHASE_STATUS_STYLES: Record<PurchaseStatus, string> = {
  PENDING_MANAGER: "bg-amber-50 text-amber-800 ring-amber-200",
  PENDING_APPROVAL: "bg-sky-50 text-sky-700 ring-sky-200",
  APPROVED: "bg-violet-50 text-violet-700 ring-violet-200",
  RECEIVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
  CANCELLED: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

// التقدير = مجموع (الكمية × السعر التقديري) بالهللات لتجنب أخطاء الكسور
export function estimateTotal(items: { quantity: number; estUnitPrice: Prisma.Decimal | number | string | null }[]) {
  const h = items.reduce((sum, i) => sum + i.quantity * Math.round(Number(i.estUnitPrice ?? 0) * 100), 0);
  return h / 100;
}

type P = { requestedById: string; status: PurchaseStatus };

// يبدأ الطلب عند المدير المباشر إن وُجد له حساب دخول، وإلا يذهب مباشرة لاعتماد الشؤون الإدارية
export async function firstStatus(db: PrismaClient, requesterId: string): Promise<PurchaseStatus> {
  const emp = await db.employee.findUnique({ where: { userId: requesterId }, select: { manager: { select: { userId: true } } } });
  const mgr = emp?.manager?.userId;
  return mgr && mgr !== requesterId ? "PENDING_MANAGER" : "PENDING_APPROVAL";
}

export async function canManagerDecide(db: PrismaClient, user: CurrentUser, p: P) {
  return p.status === "PENDING_MANAGER" && isDirectManager(db, user, p.requestedById);
}
export function canApprovePurchase(user: CurrentUser, p: P) {
  return p.status === "PENDING_APPROVAL" && can(user, SECTION, "MANAGE") && (user.isAdmin || p.requestedById !== user.id);
}
export async function canViewPurchase(db: PrismaClient, user: CurrentUser, p: P) {
  return can(user, SECTION) || p.requestedById === user.id || isDirectManager(db, user, p.requestedById);
}

// الطلبات التي تنتظر إجرائي
export function purchaseQueueWhere(user: CurrentUser): Prisma.PurchaseRequestWhereInput {
  const or: Prisma.PurchaseRequestWhereInput[] = [];
  if (user.employeeId) or.push({ status: "PENDING_MANAGER", requestedBy: { employee: { managerId: user.employeeId } }, requestedById: { not: user.id } });
  if (can(user, SECTION, "MANAGE")) or.push({ status: "PENDING_APPROVAL", ...(user.isAdmin ? {} : { requestedById: { not: user.id } }) });
  if (can(user, SECTION, "EDIT")) or.push({ status: "APPROVED" });
  return or.length ? { OR: or } : { id: "__none__" };
}
