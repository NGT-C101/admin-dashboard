import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { can, requireUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { formatDate, formatSAR } from "@/lib/format";
import { formatIban } from "@/lib/hr";
import { minutesText, monthLabel } from "@/lib/time";
import { daysText } from "@/lib/clients";

const n = (v: unknown) => Number(String(v ?? 0));

// قسيمة الراتب: للإدارة الكاملة، أو للموظف نفسه بعد اعتماد المسير
export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const s = await db.payslip.findUnique({ where: { id }, include: { run: true, employee: { include: { position: { select: { title: true } } } } } });
  if (!s) notFound();
  const own = user.employeeId === s.employeeId && s.run.status !== "DRAFT";
  if (!own && !can(user, "employees", "MANAGE")) redirect("/");

  const earnings: [string, unknown][] = [["الراتب الأساسي", s.basic], ["بدل السكن", s.housing], ["بدل النقل", s.transport], ["بدلات أخرى", s.otherAllowances], ["عمل إضافي", s.overtime], ["مكافأة", s.bonus]];
  const deductions: [string, unknown][] = [
    [`غياب / إجازة بدون راتب (${daysText(s.absenceDays)})`, s.absenceDeduction], [`تأخير (${minutesText(s.lateMinutes)})`, s.lateDeduction],
    ["التأمينات الاجتماعية", s.gosiDeduction], [`خصومات أخرى${s.otherDeductionNote ? ` — ${s.otherDeductionNote}` : ""}`, s.otherDeduction],
  ];
  const Rows = ({ rows }: { rows: [string, unknown][] }) => (
    <tbody>{rows.filter(([, v]) => n(v) !== 0).map(([l, v]) => <tr key={l} className="border-b border-neutral-100"><td className="py-1.5">{l}</td><td className="py-1.5 text-left">{formatSAR(v as never)}</td></tr>)}</tbody>
  );

  return (
    <div className="space-y-4">
      <div className="print:hidden flex justify-end"><PrintButton /></div>
      <article className="mx-auto max-w-3xl bg-white p-8 shadow-sm print:shadow-none print:p-0 text-[15px]">
        <header className="flex items-center justify-between border-b-4 border-brand-700 pb-4">
          <div><p className="text-sm text-neutral-500">قسيمة راتب</p><h1 className="text-2xl font-bold">{monthLabel(s.run.month)}</h1></div>
          <div className="text-left"><Image src={BRAND.logoOnLight} alt={BRAND.short} width={120} height={66} className="w-24 h-auto mr-auto" /><p className="text-xs text-neutral-500">{BRAND.company}</p></div>
        </header>
        <section className="mt-5 grid grid-cols-2 gap-y-1.5 text-sm">
          <div><span className="text-neutral-500">الموظف: </span><b>{s.employee.fullName}</b></div>
          <div><span className="text-neutral-500">الرقم الوظيفي: </span><span dir="ltr">EMP-{String(s.employee.number).padStart(4, "0")}</span></div>
          <div><span className="text-neutral-500">المسمى الوظيفي: </span>{s.employee.position?.title ?? s.employee.jobTitle}</div>
          <div><span className="text-neutral-500">أيام الاستحقاق: </span>{s.paidDays} / 30</div>
          {s.iban && <div className="col-span-2"><span className="text-neutral-500">الحساب: </span>{s.bankName ? `${s.bankName} — ` : ""}<span dir="ltr" className="font-mono">{formatIban(s.iban)}</span></div>}
        </section>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div><h2 className="font-bold text-emerald-800 border-b-2 border-emerald-600 pb-1 mb-2">المستحقات</h2>
            <table className="w-full text-sm"><Rows rows={earnings} /><tfoot><tr><td className="pt-2 font-semibold">الإجمالي</td><td className="pt-2 text-left font-bold">{formatSAR(s.gross)}</td></tr></tfoot></table></div>
          <div><h2 className="font-bold text-rose-800 border-b-2 border-rose-600 pb-1 mb-2">الاستقطاعات</h2>
            <table className="w-full text-sm"><Rows rows={deductions} /><tfoot><tr><td className="pt-2 font-semibold">الإجمالي</td><td className="pt-2 text-left font-bold">{formatSAR(s.totalDeductions)}</td></tr></tfoot></table></div>
        </div>
        <div className="mt-6 flex items-center justify-between rounded-xl bg-brand-50 p-4 ring-1 ring-brand-200">
          <span className="font-semibold text-brand-900">صافي الراتب</span><span className="text-2xl font-bold text-brand-800">{formatSAR(s.net)}</span>
        </div>
        {s.note && <p className="mt-4 text-sm text-neutral-600">ملاحظة: {s.note}</p>}
        <footer className="mt-10 flex justify-between border-t border-neutral-200 pt-3 text-xs text-neutral-500">
          <span>{BRAND.company} — {BRAND.slogan}</span><span>تاريخ الإصدار: {formatDate(new Date())}</span>
        </footer>
      </article>
    </div>
  );
}
