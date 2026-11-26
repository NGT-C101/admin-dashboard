import "server-only";
import { attendanceData, monthSummary } from "./attendance";
import type { CurrentUser } from "./auth";
import { can } from "./auth";
import { db } from "./db";
import { DAY_MS, riyadhToday } from "./time";

export const CRITERIA = [
  { key: "quality", label: "جودة العمل والدقة", hint: "خلو المعاملات والمستندات من الأخطاء" },
  { key: "productivity", label: "الإنتاجية وإنجاز المهام", hint: "حجم العمل المنجز في الوقت المحدد" },
  { key: "discipline", label: "الانضباط والالتزام بالدوام", hint: "الحضور والمواعيد والأنظمة الداخلية" },
  { key: "service", label: "خدمة العملاء والتواصل", hint: "التعامل المهني وسرعة الاستجابة" },
  { key: "teamwork", label: "العمل الجماعي والتعاون", hint: "مساندة الزملاء وتبادل المعرفة" },
  { key: "initiative", label: "المبادرة وحل المشكلات", hint: "اقتراح الحلول وتجاوز العقبات" },
  { key: "expertise", label: "المعرفة بالأنظمة والمنصات الحكومية", hint: "الإلمام بالإجراءات والمتطلبات النظامية" },
] as const;
export type Scores = Partial<Record<(typeof CRITERIA)[number]["key"], number>>;

export const SCORE_LABELS = ["", "ضعيف", "مقبول", "جيد", "جيد جداً", "ممتاز"];

export function rating(score: number) {
  if (score >= 4.5) return { label: "ممتاز", cls: "bg-emerald-600 text-white" };
  if (score >= 3.75) return { label: "جيد جداً", cls: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" };
  if (score >= 2.75) return { label: "جيد", cls: "bg-sky-50 text-sky-800 ring-1 ring-sky-200" };
  if (score >= 1.75) return { label: "مقبول", cls: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" };
  return { label: "يحتاج إلى تحسين", cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" };
}

export const REVIEW_STATUS_LABELS = { DRAFT: "مسودة", SUBMITTED: "أُرسل للموظف", ACKNOWLEDGED: "اطّلع عليه الموظف" } as const;

// فترات التقييم: سنوي، نصف سنوي، ربع سنوي
export function periodRange(key: string) {
  const m = key.match(/^(\d{4})(?:-(Q[1-4]|H[12]))?$/);
  if (!m) return null;
  const y = Number(m[1]);
  let a = 0, b = 12;
  if (m[2]?.startsWith("Q")) { const q = Number(m[2][1]); a = (q - 1) * 3; b = q * 3; }
  if (m[2]?.startsWith("H")) { const h = Number(m[2][1]); a = (h - 1) * 6; b = h * 6; }
  return { start: new Date(Date.UTC(y, a, 1)), end: new Date(Date.UTC(y, b, 1) - DAY_MS) };
}
export function periodLabel(key: string) {
  const m = key.match(/^(\d{4})(?:-(Q[1-4]|H[12]))?$/);
  if (!m) return key;
  const names: Record<string, string> = { Q1: "الربع الأول", Q2: "الربع الثاني", Q3: "الربع الثالث", Q4: "الربع الرابع", H1: "النصف الأول", H2: "النصف الثاني" };
  return m[2] ? `${names[m[2]]} ${m[1]}` : `السنة ${m[1]}`;
}
export function periodOptions() {
  const y = riyadhToday().getUTCFullYear();
  return [y, y - 1].flatMap((yr) => [`${yr}-Q4`, `${yr}-Q3`, `${yr}-Q2`, `${yr}-Q1`, `${yr}-H2`, `${yr}-H1`, `${yr}`]);
}
export function currentPeriod() {
  const t = riyadhToday();
  return `${t.getUTCFullYear()}-Q${Math.floor(t.getUTCMonth() / 3) + 1}`;
}

export type Metrics = {
  completed: number; onTime: number; openNow: number; overdueNow: number;
  workdays: number; present: number; absent: number; leave: number; lateCount: number; lateMinutes: number; commitment: number | null;
};

// مؤشرات تلقائية من المنصة للموظف خلال الفترة
export async function computeMetrics(e: { id: string; hireDate: Date; userId: string | null }, start: Date, end: Date): Promise<Metrics> {
  const today = riyadhToday();
  const to = end < today ? end : today;
  let completed = 0, onTime = 0, openNow = 0, overdueNow = 0;
  if (e.userId) {
    const done = await db.transaction.findMany({
      where: { assigneeId: e.userId, events: { some: { createdAt: { gte: start, lt: new Date(end.getTime() + DAY_MS) }, stage: { kind: "DONE" } } } },
      select: { dueDate: true, events: { where: { stage: { kind: "DONE" } }, select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 } },
    });
    completed = done.length;
    onTime = done.filter((t) => !t.dueDate || (t.events[0] && t.events[0].createdAt <= new Date(t.dueDate.getTime() + DAY_MS))).length;
    [openNow, overdueNow] = await Promise.all([
      db.transaction.count({ where: { assigneeId: e.userId, stage: { kind: "OPEN" } } }),
      db.transaction.count({ where: { assigneeId: e.userId, stage: { kind: "OPEN" }, dueDate: { lt: new Date() } } }),
    ]);
  }
  let att = { workdays: 0, present: 0, absent: 0, leave: 0, lateCount: 0, lateMinutes: 0 };
  if (to >= start) att = monthSummary(e, start, to, await attendanceData([e.id], start, to));
  const commitment = att.workdays ? Math.round(((att.present + att.leave) / att.workdays) * 100) : null;
  return { completed, onTime, openNow, overdueNow, ...att, commitment };
}

// مين يقيّم: المدير المباشر، أو صاحب صلاحية التعديل على الموظفين — ومش نفسه
export function canReview(user: CurrentUser, e: { id: string; manager: { userId: string | null } | null }) {
  if (user.employeeId === e.id) return false;
  return e.manager?.userId === user.id || can(user, "employees", "EDIT");
}
