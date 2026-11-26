import Link from "next/link";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import { MonthField } from "@/components/ui/DateField";
import { Field, FieldGrid } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatSAR } from "@/lib/format";
import { PAYROLL_STATUS_LABELS, PAYROLL_STATUS_STYLES, getPayrollSettings } from "@/lib/payroll";
import { currentMonthKey, monthLabel } from "@/lib/time";
import { createRun, updatePayrollSettings } from "../payroll-actions";

export default async function PayrollPage() {
  await requireSection("employees", "MANAGE");
  const [runs, s] = await Promise.all([
    db.payrollRun.findMany({ orderBy: { month: "desc" }, include: { _count: { select: { slips: true } } } }),
    getPayrollSettings(),
  ]);
  const sums = await db.payslip.groupBy({ by: ["runId"], _sum: { net: true, gross: true } });
  const sumOf = (id: string) => sums.find((x) => x.runId === id)?._sum;

  return (
    <div className="space-y-6">
      <PageHeader title="الرواتب والمستحقات" crumbs={[{ label: "الموظفين", href: "/employees/profiles" }, { label: "مسير الرواتب" }]} />
      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">إعداد مسير رواتب جديد</h2>
        <p className="text-sm text-neutral-600">يُحسب تلقائياً لكل موظف: الراتب والبدلات (بالتناسب عند الالتحاق أو انتهاء الخدمة خلال الشهر)، وخصم الغياب والإجازة بدون راتب من سجل الحضور، واستقطاع التأمينات. ثم يمكنك إضافة الإضافي والمكافآت والخصومات الأخرى قبل الاعتماد.</p>
        <ActionForm action={createRun} submitLabel="إنشاء المسير" className="flex flex-wrap items-end gap-3">
          <MonthField name="month" defaultValue={currentMonthKey()} />
        </ActionForm>
      </section>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>الشهر</th><th>الحالة</th><th>عدد الموظفين</th><th>إجمالي المستحقات</th><th>صافي الرواتب</th><th>الاعتماد</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/employees/payroll/${r.id}`} className="link">{monthLabel(r.month)}</Link></td>
                <td><Badge className={PAYROLL_STATUS_STYLES[r.status]}>{PAYROLL_STATUS_LABELS[r.status]}</Badge></td>
                <td>{r._count.slips}</td>
                <td>{formatSAR(sumOf(r.id)?.gross ?? 0)}</td>
                <td className="font-bold text-brand-800">{formatSAR(sumOf(r.id)?.net ?? 0)}</td>
                <td className="text-xs text-neutral-500">{r.approvedAt ? formatDate(r.approvedAt) : "—"}</td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={6} className="text-center text-neutral-500 py-8">لا توجد مسيرات رواتب بعد</td></tr>}
          </tbody>
        </table>
      </div>

      <Collapsible label="إعدادات الاستقطاعات">
        <ActionForm action={updatePayrollSettings} submitLabel="حفظ الإعدادات" resetOnSuccess={false}>
          <FieldGrid>
            <Field label="استقطاع التأمينات — السعودي (%)"><input name="gosiSaudiRate" type="number" step="0.01" min={0} max={30} defaultValue={s.gosiSaudiRate} className="input" /></Field>
            <Field label="استقطاع التأمينات — غير السعودي (%)"><input name="gosiNonSaudiRate" type="number" step="0.01" min={0} max={30} defaultValue={s.gosiNonSaudiRate} className="input" /></Field>
            <Field label="الحد الأعلى لأجر الاشتراك (ريال)"><input name="gosiCap" type="number" min={0} defaultValue={s.gosiCap} className="input" /></Field>
          </FieldGrid>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="deductAbsence" defaultChecked={s.deductAbsence} className="size-4 accent-brand-600" /> خصم أيام الغياب والإجازة بدون راتب (أجر يوم = إجمالي الراتب ÷ 30)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="deductLate" defaultChecked={s.deductLate} className="size-4 accent-brand-600" /> خصم دقائق التأخير (بالتناسب مع ساعات الدوام)</label>
          <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2">يُستقطع من الموظف المسجّل في التأمينات نسبة من (الأساسي + السكن). القيم الافتراضية استرشادية — يُرجى التحقق من النسب السارية لدى المؤسسة العامة للتأمينات الاجتماعية.</p>
        </ActionForm>
      </Collapsible>
    </div>
  );
}
