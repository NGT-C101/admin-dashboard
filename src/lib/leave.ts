import "server-only";
import type { LeaveType, Prisma, RequestStatus } from "@prisma/client";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import { can } from "./auth";
import { serviceParts } from "./hr";
import { DAY_MS, dateKey, isWeekend, riyadhToday } from "./time";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  ANNUAL: "إجازة سنوية",
  SICK: "إجازة مرضية",
  UNPAID: "إجازة بدون راتب",
  MARRIAGE: "إجازة زواج",
  BEREAVEMENT: "إجازة وفاة",
  PATERNITY: "إجازة مولود",
  MATERNITY: "إجازة وضع",
  HAJJ: "إجازة حج",
  EXAM: "إجازة امتحانات",
  OTHER: "إجازة أخرى",
};
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: "بانتظار الموافقة",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  CANCELLED: "ملغى",
};
export const REQUEST_STATUS_STYLES: Record<RequestStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
  CANCELLED: "bg-neutral-100 text-neutral-500 ring-neutral-200",
};
export const leaveNo = (n: number) => `L-${String(n).padStart(4, "0")}`;

// العطلات الرسمية كمجموعة أيام
export async function holidaySet(from: Date, to: Date) {
  const hs = await db.holiday.findMany({ where: { startDate: { lte: to }, endDate: { gte: from } } });
  const set = new Set<string>();
  for (const h of hs) for (let t = h.startDate.getTime(); t <= h.endDate.getTime(); t += DAY_MS) set.add(dateKey(new Date(t)));
  return set;
}

// أيام العمل بين تاريخين (من غير الجمعة والسبت والعطلات الرسمية)
export function workingDays(start: Date, end: Date, holidays: Set<string>) {
  let n = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const d = new Date(t);
    if (!isWeekend(d) && !holidays.has(dateKey(d))) n++;
  }
  return n;
}

// رصيد الإجازة السنوية للسنة الحالية
// 21 يوماً، و30 يوماً لمن أكمل 5 سنوات (المادة 109 من نظام العمل)، بالتناسب لسنة الالتحاق
export async function annualBalance(e: { id: string; hireDate: Date; leaveCarryover: number }) {
  const today = riyadhToday();
  const year = today.getUTCFullYear();
  const yStart = new Date(Date.UTC(year, 0, 1)), yEnd = new Date(Date.UTC(year, 11, 31));
  const entitlement = serviceParts(e.hireDate).totalYears >= 5 ? 30 : 21;
  const from = e.hireDate > yStart ? e.hireDate : yStart;
  const portion = Math.max(0, (yEnd.getTime() - from.getTime()) / DAY_MS + 1) / 365;
  const accrued = Math.round(entitlement * Math.min(1, portion) * 2) / 2;
  const where: Prisma.LeaveRequestWhereInput = { employeeId: e.id, kind: "LEAVE", type: "ANNUAL", startDate: { gte: yStart, lte: yEnd } };
  const [used, pending] = await Promise.all([
    db.leaveRequest.aggregate({ where: { ...where, status: "APPROVED" }, _sum: { days: true } }),
    db.leaveRequest.aggregate({ where: { ...where, status: "PENDING" }, _sum: { days: true } }),
  ]);
  const total = accrued + e.leaveCarryover;
  const usedDays = used._sum.days ?? 0;
  return { year, entitlement, accrued, carryover: e.leaveCarryover, total, used: usedDays, pending: pending._sum.days ?? 0, remaining: total - usedDays };
}

// مين يقدر يوافق: المدير المباشر (لو عنده حساب)، أو صاحب الإدارة الكاملة على الموظفين — ومش على طلبه هو
export function canDecide(user: CurrentUser, req: { employeeId: string; employee: { manager: { userId: string | null } | null } }) {
  if (user.employeeId === req.employeeId) return false;
  return req.employee.manager?.userId === user.id || can(user, "employees", "MANAGE");
}

// الطلبات اللي مستنية قرار المستخدم ده
export function pendingForWhere(user: CurrentUser): Prisma.LeaveRequestWhereInput {
  const base: Prisma.LeaveRequestWhereInput = { status: "PENDING", ...(user.employeeId ? { employeeId: { not: user.employeeId } } : {}) };
  return can(user, "employees", "MANAGE") ? base : { ...base, employee: { manager: { userId: user.id } } };
}
