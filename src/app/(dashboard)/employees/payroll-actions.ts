"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalMoney, optionalText } from "@/lib/forms";
import { computeSlip, eligibleWhere, getPayrollSettings, savePayrollSettings, totals } from "@/lib/payroll";
import { getSchedule } from "@/lib/schedule";

const reval = (id?: string) => { revalidatePath("/employees/payroll"); if (id) revalidatePath(`/employees/payroll/${id}`); revalidatePath("/me"); };

async function generate(runId: string, month: string, keepManual: boolean) {
  const [s, schedule, emps, old] = await Promise.all([
    getPayrollSettings(), getSchedule(),
    db.employee.findMany({ where: eligibleWhere(month) }),
    db.payslip.findMany({ where: { runId } }),
  ]);
  const prev = new Map(old.map((p) => [p.employeeId, p]));
  await db.$transaction(async (tx) => {
    await tx.payslip.deleteMany({ where: { runId, employeeId: { notIn: emps.map((e) => e.id) } } });
    for (const e of emps) {
      const auto = await computeSlip(e, month, s, schedule);
      const p = keepManual ? prev.get(e.id) : undefined;
      const manual = { overtime: p?.overtime ?? 0, bonus: p?.bonus ?? 0, otherDeduction: p?.otherDeduction ?? 0, otherDeductionNote: p?.otherDeductionNote ?? null, note: p?.note ?? null };
      const data = { ...auto, ...manual, ...totals({ ...auto, ...manual }) };
      await tx.payslip.upsert({ where: { runId_employeeId: { runId, employeeId: e.id } }, update: data, create: { runId, employeeId: e.id, ...data } });
    }
  }, { timeout: 60000 });
}

export async function createRun(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSection("employees", "MANAGE");
  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "يرجى اختيار الشهر" };
  if (await db.payrollRun.findUnique({ where: { month } })) return { error: "يوجد مسير رواتب لهذا الشهر مسبقاً" };
  const run = await db.payrollRun.create({ data: { month, createdById: user.id } });
  await generate(run.id, month, false);
  redirect(`/employees/payroll/${run.id}`);
}

// إعادة الحساب (بعد تعديل حضور أو راتب) مع الاحتفاظ بالإضافي والمكافآت والخصومات اليدوية
export async function recalcRun(formData: FormData) {
  await requireSection("employees", "MANAGE");
  const run = await db.payrollRun.findUnique({ where: { id: String(formData.get("id")) } });
  if (!run || run.status !== "DRAFT") return;
  await generate(run.id, run.month, true);
  reval(run.id);
}

const slipSchema = z.object({
  id: z.string(),
  overtime: optionalMoney, bonus: optionalMoney, otherDeduction: optionalMoney,
  otherDeductionNote: optionalText, note: optionalText,
});

export async function updateSlip(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("employees", "MANAGE");
  const p = slipSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: firstError(p.error) };
  const slip = await db.payslip.findUnique({ where: { id: p.data.id }, include: { run: true } });
  if (!slip || slip.run.status !== "DRAFT") return { error: "المسير معتمد ولا يمكن تعديله" };
  const manual = { overtime: p.data.overtime ?? "0", bonus: p.data.bonus ?? "0", otherDeduction: p.data.otherDeduction ?? "0", otherDeductionNote: p.data.otherDeductionNote, note: p.data.note };
  await db.payslip.update({ where: { id: slip.id }, data: { ...manual, ...totals({ ...slip, ...manual }) } });
  reval(slip.runId);
  return { success: "تم الحفظ" };
}

export async function setRunStatus(formData: FormData) {
  const user = await requireSection("employees", "MANAGE");
  const run = await db.payrollRun.findUnique({ where: { id: String(formData.get("id")) } });
  const to = String(formData.get("status"));
  if (!run) return;
  const allowed: Record<string, string[]> = { DRAFT: ["APPROVED"], APPROVED: ["PAID", "DRAFT"], PAID: [] };
  if (!allowed[run.status].includes(to)) return;
  await db.payrollRun.update({
    where: { id: run.id },
    data: to === "APPROVED" ? { status: "APPROVED", approvedById: user.id, approvedAt: new Date() }
      : to === "PAID" ? { status: "PAID", paidAt: new Date() } : { status: "DRAFT", approvedById: null, approvedAt: null },
  });
  reval(run.id);
}

export async function deleteRun(formData: FormData) {
  await requireSection("employees", "MANAGE");
  const run = await db.payrollRun.findUnique({ where: { id: String(formData.get("id")) } });
  if (!run || run.status !== "DRAFT") return;
  await db.payrollRun.delete({ where: { id: run.id } });
  reval();
  redirect("/employees/payroll");
}

const settingsSchema = z.object({
  gosiSaudiRate: z.coerce.number().min(0).max(30), gosiNonSaudiRate: z.coerce.number().min(0).max(30), gosiCap: z.coerce.number().min(0),
  deductAbsence: z.string().optional().transform((v) => v === "on"), deductLate: z.string().optional().transform((v) => v === "on"),
});
export async function updatePayrollSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("employees", "MANAGE");
  const p = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: "يرجى إدخال نسب صحيحة" };
  await savePayrollSettings(p.data);
  reval();
  return { success: "تم حفظ الإعدادات — أعد حساب المسيرات المسودة لتطبيقها" };
}
