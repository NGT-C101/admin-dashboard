import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, CheckCircle2, FileDown, Printer, RotateCcw, Trash2, Wallet } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatSAR } from "@/lib/format";
import { formatIban } from "@/lib/hr";
import { PAYROLL_STATUS_LABELS, PAYROLL_STATUS_STYLES } from "@/lib/payroll";
import { minutesText, monthLabel } from "@/lib/time";
import { daysText } from "@/lib/clients";
import { deleteRun, recalcRun, setRunStatus, updateSlip } from "../../payroll-actions";

const n = (v: unknown) => Number(String(v ?? 0));

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("employees", "MANAGE");
  const { id } = await params;
  const run = await db.payrollRun.findUnique({
    where: { id },
    include: {
      approvedBy: { select: { name: true } },
      slips: { include: { employee: { select: { id: true, fullName: true, number: true, jobTitle: true } } }, orderBy: { employee: { fullName: "asc" } } },
    },
  });
  if (!run) notFound();
  const draft = run.status === "DRAFT";
  const sum = (k: "gross" | "totalDeductions" | "net" | "gosiDeduction") => run.slips.reduce((a, s) => a + n(s[k]), 0);
  const missingIban = run.slips.filter((s) => !s.iban).length;

  const Btn = ({ to, label, icon: I, primary }: { to: string; label: string; icon: typeof Wallet; primary?: boolean }) => (
    <form action={setRunStatus}><input type="hidden" name="id" value={run.id} /><input type="hidden" name="status" value={to} />
      <button className={primary ? "btn-primary" : "btn-secondary"}><I size={16} /> {label}</button></form>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={`مسير رواتب ${monthLabel(run.month)}`} crumbs={[{ label: "مسير الرواتب", href: "/employees/payroll" }, { label: monthLabel(run.month) }]}
        actions={<Badge className={PAYROLL_STATUS_STYLES[run.status]}>{PAYROLL_STATUS_LABELS[run.status]}</Badge>} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[["عدد الموظفين", run.slips.length], ["إجمالي المستحقات", formatSAR(sum("gross"))], ["إجمالي الاستقطاعات", formatSAR(sum("totalDeductions"))], ["صافي الرواتب", formatSAR(sum("net"))]].map(([l, v], i) => (
          <div key={l as string} className={`card p-4 ${i === 3 ? "ring-2 ring-brand-600/30" : ""}`}><div className={`text-xl font-bold ${i === 3 ? "text-brand-800" : ""}`}>{v}</div><div className="text-sm text-neutral-500">{l}</div></div>
        ))}
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-2">
        {draft && <form action={recalcRun}><input type="hidden" name="id" value={run.id} /><button className="btn-secondary"><Calculator size={16} /> إعادة الحساب</button></form>}
        {draft && <Btn to="APPROVED" label="اعتماد المسير" icon={CheckCircle2} primary />}
        {run.status === "APPROVED" && <Btn to="PAID" label="تأكيد صرف الرواتب" icon={Wallet} primary />}
        {run.status === "APPROVED" && <Btn to="DRAFT" label="إعادة إلى مسودة" icon={RotateCcw} />}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href={`/api/export/payroll?run=${run.id}`} className="btn-secondary"><FileDown size={16} /> ملف التحويل البنكي (Excel)</a>
        {draft && <form action={deleteRun} className="mr-auto"><input type="hidden" name="id" value={run.id} /><button className="text-sm text-rose-600 flex items-center gap-1"><Trash2 size={15} /> حذف المسودة</button></form>}
        {run.approvedAt && <span className="mr-auto text-xs text-neutral-500">اعتمده {run.approvedBy?.name} · {formatDateTime(run.approvedAt)}{run.paidAt && ` · صُرف ${formatDateTime(run.paidAt)}`}</span>}
      </div>
      {missingIban > 0 && <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">⚠️ {missingIban} موظف بدون رقم آيبان — لن تكتمل بياناتهم في ملف التحويل البنكي.</p>}
      {draft && <p className="text-xs text-neutral-500">💡 بعد تعديل سجل الحضور أو رواتب الموظفين اضغط «إعادة الحساب». تبقى المبالغ اليدوية (الإضافي، المكافآت، الخصومات الأخرى) كما هي.</p>}

      <div className="space-y-3">
        {run.slips.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-48">
                <Link href={`/employees/profiles/${s.employee.id}`} className="font-semibold hover:underline">{s.employee.fullName}</Link>
                <div className="text-xs text-neutral-500">EMP-{String(s.employee.number).padStart(4, "0")} · {s.employee.jobTitle}</div>
                {s.paidDays < 30 && <div className="text-xs text-amber-700 mt-1">مستحق عن {daysText(s.paidDays)} من 30</div>}
              </div>
              <dl className="flex-1 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                {[["الأساسي", s.basic], ["السكن", s.housing], ["النقل", s.transport], ["بدلات أخرى", s.otherAllowances]].map(([l, v]) => (
                  <div key={l as string}><dt className="text-neutral-500">{l as string}</dt><dd className="font-medium">{formatSAR(v as never)}</dd></div>
                ))}
                <div><dt className="text-neutral-500">الغياب ({s.absenceDays ? daysText(s.absenceDays) : "لا يوجد"})</dt><dd className="font-medium text-rose-700">{n(s.absenceDeduction) ? `− ${formatSAR(s.absenceDeduction)}` : "—"}</dd></div>
                <div><dt className="text-neutral-500">التأخير ({minutesText(s.lateMinutes)})</dt><dd className="font-medium text-rose-700">{n(s.lateDeduction) ? `− ${formatSAR(s.lateDeduction)}` : "—"}</dd></div>
                <div><dt className="text-neutral-500">التأمينات</dt><dd className="font-medium text-rose-700">{n(s.gosiDeduction) ? `− ${formatSAR(s.gosiDeduction)}` : "—"}</dd></div>
              </dl>
              <div className="text-left min-w-32">
                <div className="text-xs text-neutral-500">الصافي</div>
                <div className="text-xl font-bold text-brand-800">{formatSAR(s.net)}</div>
                <Link href={`/employees/payroll/slip/${s.id}`} className="text-xs link inline-flex items-center gap-1"><Printer size={12} /> القسيمة</Link>
              </div>
            </div>
            {draft ? (
              <ActionForm action={updateSlip} submitLabel="حفظ" resetOnSuccess={false} className="mt-3 flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3">
                <input type="hidden" name="id" value={s.id} />
                <label className="text-xs space-y-1"><span className="block text-neutral-500">عمل إضافي</span><input name="overtime" inputMode="decimal" dir="ltr" defaultValue={n(s.overtime) || ""} className="input !py-1 w-28" /></label>
                <label className="text-xs space-y-1"><span className="block text-neutral-500">مكافأة</span><input name="bonus" inputMode="decimal" dir="ltr" defaultValue={n(s.bonus) || ""} className="input !py-1 w-28" /></label>
                <label className="text-xs space-y-1"><span className="block text-neutral-500">خصم آخر</span><input name="otherDeduction" inputMode="decimal" dir="ltr" defaultValue={n(s.otherDeduction) || ""} className="input !py-1 w-28" /></label>
                <label className="text-xs space-y-1"><span className="block text-neutral-500">سبب الخصم</span><input name="otherDeductionNote" defaultValue={s.otherDeductionNote ?? ""} placeholder="مثال: قسط سلفة" className="input !py-1 w-40" /></label>
                <label className="text-xs space-y-1 flex-1 min-w-40"><span className="block text-neutral-500">ملاحظة على القسيمة</span><input name="note" defaultValue={s.note ?? ""} className="input !py-1" /></label>
              </ActionForm>
            ) : (n(s.overtime) || n(s.bonus) || n(s.otherDeduction)) ? (
              <div className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-600 flex flex-wrap gap-4">
                {n(s.overtime) > 0 && <span>إضافي: {formatSAR(s.overtime)}</span>}{n(s.bonus) > 0 && <span>مكافأة: {formatSAR(s.bonus)}</span>}
                {n(s.otherDeduction) > 0 && <span className="text-rose-700">خصم: {formatSAR(s.otherDeduction)}{s.otherDeductionNote && ` (${s.otherDeductionNote})`}</span>}
              </div>
            ) : null}
            {s.iban && <div className="mt-2 text-[11px] text-neutral-400" dir="ltr">{s.bankName ? `${s.bankName} · ` : ""}{formatIban(s.iban)}</div>}
          </div>
        ))}
        {run.slips.length === 0 && <div className="card p-10 text-center text-neutral-500">لا يوجد موظفون مستحقون لهذا الشهر</div>}
      </div>
    </div>
  );
}
