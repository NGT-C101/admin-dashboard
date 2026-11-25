import "server-only";
// تنبيهات الموارد البشرية: إقامات وجوازات وعقود وفترات تجربة ومستندات قربت تنتهي
import { db } from "./db";
import { inDays } from "./clients";
import { DOC_TYPE_LABELS } from "./documents";

export const HR_ALERT_DAYS = 60;

export type HrAlert = { employeeId: string; name: string; label: string; date: Date };

export async function getHrAlerts(): Promise<HrAlert[]> {
  const horizon = inDays(HR_ALERT_DAYS);
  const current = { status: { not: "TERMINATED" as const } };
  const [emps, docs] = await Promise.all([
    db.employee.findMany({
      where: { ...current, OR: [
        { idExpiry: { lte: horizon } }, { passportExpiry: { lte: horizon } },
        { contractEnd: { lte: horizon } }, { probationEnd: { lte: horizon, gte: inDays(-7) } },
      ] },
      select: { id: true, fullName: true, nationality: true, idExpiry: true, passportExpiry: true, contractEnd: true, probationEnd: true },
    }),
    db.document.findMany({
      where: { employee: current, expiresAt: { not: null, lte: horizon } },
      select: { type: true, title: true, expiresAt: true, employee: { select: { id: true, fullName: true } } },
    }),
  ]);
  const out: HrAlert[] = [];
  for (const e of emps) {
    const isSaudi = (e.nationality ?? "").includes("سعودي");
    if (e.idExpiry && e.idExpiry <= horizon) out.push({ employeeId: e.id, name: e.fullName, label: isSaudi ? "انتهاء الهوية الوطنية" : "انتهاء الإقامة", date: e.idExpiry });
    if (e.passportExpiry && e.passportExpiry <= horizon) out.push({ employeeId: e.id, name: e.fullName, label: "انتهاء جواز السفر", date: e.passportExpiry });
    if (e.contractEnd && e.contractEnd <= horizon) out.push({ employeeId: e.id, name: e.fullName, label: "انتهاء عقد العمل", date: e.contractEnd });
    if (e.probationEnd && e.probationEnd <= horizon && e.probationEnd >= inDays(-7)) out.push({ employeeId: e.id, name: e.fullName, label: "نهاية فترة التجربة", date: e.probationEnd });
  }
  for (const d of docs) out.push({ employeeId: d.employee!.id, name: d.employee!.fullName, label: `${DOC_TYPE_LABELS[d.type]}${d.title ? ` (${d.title})` : ""}`, date: d.expiresAt! });
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}
