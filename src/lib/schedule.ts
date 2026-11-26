import "server-only";
import { db } from "./db";

// مواعيد الدوام (من الأحد إلى الخميس)
export type WorkSchedule = { start: string; end: string; grace: number };
export const DEFAULT_SCHEDULE: WorkSchedule = { start: "08:00", end: "17:00", grace: 15 };
const KEY = "work-schedule";

export async function getSchedule(): Promise<WorkSchedule> {
  const row = await db.appMeta.findUnique({ where: { key: KEY } });
  try { return row ? { ...DEFAULT_SCHEDULE, ...JSON.parse(row.value) } : DEFAULT_SCHEDULE; } catch { return DEFAULT_SCHEDULE; }
}
export async function saveSchedule(s: WorkSchedule) {
  await db.appMeta.upsert({ where: { key: KEY }, update: { value: JSON.stringify(s) }, create: { key: KEY, value: JSON.stringify(s) } });
}
