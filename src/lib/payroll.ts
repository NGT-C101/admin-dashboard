import "server-only";
import type { Employee } from "@prisma/client";
import { attendanceData, monthSummary } from "./attendance";
import { db } from "./db";
import { holidaySet, workingDays } from "./leave";
import { DAY_MS, hmToMinutes, monthBounds } from "./time";

// إعدادات مسير الرواتب (قابلة للتعديل لأن نسب التأمينات بتتغير)
export type PayrollSettings = {
  gosiSaudiRate: number;    // نسبة استقطاع الموظف السعودي من (الأساسي + السكن) %
  gosiNonSaudiRate: number; // نسبة استقطاع غير السعودي %
  gosiCap: number;          // الحد الأعلى لأجر الاشتراك
  deductAbsence: boolean;   // خصم أيام الغياب والإجازة بدون راتب
  deductLate: boolean;      // خصم دقائق التأخير
};
export const DEFAULT_PAYROLL: PayrollSettings = { gosiSaudiRate: 9.75, gosiNonSaudiRate: 0, gosiCap: 45000, deductAbsence: true, deductLate: false };
const KEY = "payroll-settings";

export async function getPayrollSettings(): Promise<PayrollSettings> {
  const row = await db.appMeta.findUnique({ where: { key: KEY } });
  try { return row ? { ...DEFAULT_PAYROLL, ...JSON.parse(row.value) } : DEFAULT_PAYROLL; } catch { return DEFAULT_PAYROLL; }
}
export async function savePayrollSettings(s: PayrollSettings) {
  await db.appMeta.upsert({ where: { key: KEY }, update: { value: JSON.stringify(s) }, create: { key: KEY, value: JSON.stringify(s) } });
}

const num = (v: { toString(): string } | null | undefined) => (v ? Number(v.toString()) : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;
export const isSaudi = (nationality?: string | null) => !!nationality && nationality.includes("سعود");

// الموظفين المستحقين في الشهر (التحقوا قبل نهايته ولم تنتهِ خدمتهم قبل بدايته)
export function eligibleWhere(month: string) {
  const { start, end } = monthBounds(month);
  return {
    hireDate: { lt: end },
    OR: [{ status: { not: "TERMINATED" as const } }, { terminationDate: { gte: start } }],
  };
}

// حساب القسيمة التلقائي (المدخلات اليدوية تُضاف لاحقاً)
export async function computeSlip(e: Employee, month: string, s: PayrollSettings, schedule: { start: string; end: string }) {
  const { start, end } = monthBounds(month);
  const last = new Date(end.getTime() - DAY_MS);
  const from = e.hireDate > start ? new Date(Date.UTC(e.hireDate.getUTCFullYear(), e.hireDate.getUTCMonth(), e.hireDate.getUTCDate())) : start;
  const to = e.terminationDate && e.terminationDate < last ? e.terminationDate : last;
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const employedDays = Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1);
  // أساس 30 يوماً: الشهر الكامل = 30، والجزئي بعدد الأيام الفعلية
  const paidDays = employedDays >= daysInMonth ? 30 : Math.min(30, employedDays);
  const f = paidDays / 30;

  const basic = r2(num(e.basicSalary) * f), housing = r2(num(e.housingAllowance) * f);
  const transport = r2(num(e.transportAllowance) * f), other = r2(num(e.otherAllowances) * f);
  const fullWage = num(e.basicSalary) + num(e.housingAllowance) + num(e.transportAllowance) + num(e.otherAllowances);
  const dailyWage = fullWage / 30;

  // الغياب والتأخير من سجل الحضور + الإجازات بدون راتب
  const data = await attendanceData([e.id], from, to);
  const sum = monthSummary(e, from, to, data);
  const unpaid = await db.leaveRequest.findMany({
    where: { employeeId: e.id, kind: "LEAVE", type: "UNPAID", status: "APPROVED", startDate: { lte: to }, endDate: { gte: from } },
  });
  const hol = await holidaySet(from, to);
  const unpaidDays = unpaid.reduce((n, l) => n + workingDays(l.startDate > from ? l.startDate : from, l.endDate < to ? l.endDate : to, hol), 0);
  const absenceDays = sum.absent + unpaidDays;
  const absenceDeduction = s.deductAbsence ? r2(absenceDays * dailyWage) : 0;
  const workMinutes = Math.max(60, hmToMinutes(schedule.end) - hmToMinutes(schedule.start));
  const lateDeduction = s.deductLate ? r2(sum.lateMinutes * (dailyWage / workMinutes)) : 0;

  const rate = isSaudi(e.nationality) ? s.gosiSaudiRate : s.gosiNonSaudiRate;
  const gosiBase = Math.min(num(e.basicSalary) + num(e.housingAllowance), s.gosiCap) * f;
  const gosiDeduction = e.gosiRegistered ? r2(gosiBase * rate / 100) : 0;

  return {
    paidDays, basic, housing, transport, otherAllowances: other,
    absenceDays, absenceDeduction, lateMinutes: sum.lateMinutes, lateDeduction, gosiDeduction,
    bankName: e.bankName, iban: e.iban,
  };
}

// المجاميع بعد إضافة المدخلات اليدوية
export function totals(x: {
  basic: unknown; housing: unknown; transport: unknown; otherAllowances: unknown; overtime: unknown; bonus: unknown;
  absenceDeduction: unknown; lateDeduction: unknown; gosiDeduction: unknown; otherDeduction: unknown;
}) {
  const n = (v: unknown) => Number(String(v ?? 0));
  const gross = r2(n(x.basic) + n(x.housing) + n(x.transport) + n(x.otherAllowances) + n(x.overtime) + n(x.bonus));
  const totalDeductions = r2(n(x.absenceDeduction) + n(x.lateDeduction) + n(x.gosiDeduction) + n(x.otherDeduction));
  return { gross, totalDeductions, net: r2(gross - totalDeductions) };
}

export const PAYROLL_STATUS_LABELS = { DRAFT: "مسودة", APPROVED: "معتمد", PAID: "تم الصرف" } as const;
export const PAYROLL_STATUS_STYLES = {
  DRAFT: "bg-amber-50 text-amber-700 ring-amber-200",
  APPROVED: "bg-sky-50 text-sky-700 ring-sky-200",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
} as const;
