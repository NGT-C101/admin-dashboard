"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { CRITERIA, canReview, computeMetrics, periodRange } from "@/lib/performance";

function reval(employeeId: string) {
  revalidatePath("/employees/performance");
  revalidatePath(`/employees/profiles/${employeeId}`);
  revalidatePath("/me");
}

export async function saveReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const employeeId = String(formData.get("employeeId"));
  const period = String(formData.get("period"));
  const range = periodRange(period);
  if (!range) return { error: "فترة التقييم غير صحيحة" };
  const e = await db.employee.findUnique({ where: { id: employeeId }, include: { manager: { select: { userId: true } } } });
  if (!e) return { error: "الموظف غير موجود" };
  if (!canReview(user, e)) return { error: "ليست لديك صلاحية تقييم هذا الموظف" };
  const existing = await db.performanceReview.findUnique({ where: { employeeId_period: { employeeId, period } } });
  if (existing && existing.status !== "DRAFT") return { error: "تم إرسال هذا التقييم ولا يمكن تعديله" };

  const scores: Record<string, number> = {};
  for (const c of CRITERIA) {
    const v = Number(formData.get(`c_${c.key}`));
    if (!(v >= 1 && v <= 5)) return { error: `يرجى تقييم معيار «${c.label}»` };
    scores[c.key] = v;
  }
  const overall = Math.round((Object.values(scores).reduce((a, b) => a + b, 0) / CRITERIA.length) * 100) / 100;
  const submit = formData.get("submitToEmployee") === "on";
  const text = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const data = {
    reviewerId: user.id, periodStart: range.start, periodEnd: range.end, scores, overall,
    metrics: await computeMetrics(e, range.start, range.end),
    strengths: text("strengths"), improvements: text("improvements"), goals: text("goals"),
    ...(submit ? { status: "SUBMITTED" as const, submittedAt: new Date() } : {}),
  };
  await db.performanceReview.upsert({ where: { employeeId_period: { employeeId, period } }, update: data, create: { employeeId, period, ...data } });
  reval(employeeId);
  if (submit) redirect(`/employees/performance/review?employee=${employeeId}&period=${period}`);
  return { success: "تم حفظ المسودة" };
}

export async function reopenReview(formData: FormData) {
  const user = await requireUser();
  if (!can(user, "employees", "MANAGE")) return;
  const r = await db.performanceReview.update({ where: { id: String(formData.get("id")) }, data: { status: "DRAFT", submittedAt: null, acknowledgedAt: null } });
  reval(r.employeeId);
}

// الموظف يؤكد اطلاعه على التقييم ويضيف تعليقه
export async function acknowledgeReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const r = await db.performanceReview.findUnique({ where: { id: String(formData.get("id")) } });
  if (!r || r.employeeId !== user.employeeId || r.status !== "SUBMITTED") return { error: "غير متاح" };
  await db.performanceReview.update({
    where: { id: r.id },
    data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), employeeComment: String(formData.get("comment") ?? "").trim() || null },
  });
  reval(r.employeeId);
  return { success: "تم تأكيد الاطلاع ✅" };
}
