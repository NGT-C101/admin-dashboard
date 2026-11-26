import { notFound, redirect } from "next/navigation";
import MetricsPanel from "@/components/MetricsPanel";
import PrintButton from "@/components/PrintButton";
import ReviewView from "@/components/ReviewView";
import ScoreInput from "@/components/ScoreInput";
import ActionForm from "@/components/ui/ActionForm";
import { Field } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CRITERIA, canReview, computeMetrics, periodLabel, periodRange, type Scores } from "@/lib/performance";
import { reopenReview, saveReview } from "../../review-actions";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ employee?: string; period?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const range = periodRange(sp.period ?? "");
  if (!range || !sp.employee) notFound();
  const e = await db.employee.findUnique({ where: { id: sp.employee }, include: { manager: { select: { userId: true } }, position: { select: { title: true } } } });
  if (!e) notFound();
  const r = await db.performanceReview.findUnique({ where: { employeeId_period: { employeeId: e.id, period: sp.period! } }, include: { reviewer: { select: { name: true } } } });
  const reviewer = canReview(user, e);
  if (!reviewer && !can(user, "employees", "VIEW") && user.employeeId !== e.id) redirect("/");
  const title = `تقييم أداء ${e.fullName}`;
  const crumbs = [{ label: "تقييم الأداء", href: `/employees/performance?period=${sp.period}` }, { label: periodLabel(sp.period!) }];

  if (r && r.status !== "DRAFT") {
    return (
      <div className="space-y-6 max-w-5xl">
        <PageHeader title={title} crumbs={crumbs} actions={<div className="print:hidden flex gap-2">
          {can(user, "employees", "MANAGE") && <form action={reopenReview}><input type="hidden" name="id" value={r.id} /><button className="btn-secondary">إعادة فتح التقييم</button></form>}
          <PrintButton /></div>} />
        <ReviewView r={r} reviewerName={r.reviewer.name} />
      </div>
    );
  }
  if (!reviewer) return <div className="card p-10 text-center text-neutral-500">لم يُستكمل هذا التقييم بعد</div>;

  const metrics = await computeMetrics(e, range.start, range.end);
  const scores = (r?.scores ?? {}) as Scores;
  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader title={title} crumbs={crumbs} />
      <section className="card p-5">
        <h2 className="font-semibold">مؤشرات الفترة (تلقائية من المنصة)</h2>
        <p className="text-xs text-neutral-500 mb-3">{e.position?.title ?? e.jobTitle} · {periodLabel(sp.period!)} — تُحفظ مع التقييم عند إرساله.</p>
        <MetricsPanel m={metrics} />
      </section>
      <ActionForm action={saveReview} submitLabel="حفظ" resetOnSuccess={false} className="space-y-5">
        <input type="hidden" name="employeeId" value={e.id} /><input type="hidden" name="period" value={sp.period} />
        <section className="card p-5">
          <h2 className="font-semibold mb-1">تقييم المعايير</h2>
          {CRITERIA.map((c) => <ScoreInput key={c.key} name={`c_${c.key}`} label={c.label} hint={c.hint} value={scores[c.key]} />)}
        </section>
        <section className="card p-5 grid gap-4 md:grid-cols-3">
          <Field label="نقاط القوة"><textarea name="strengths" rows={4} defaultValue={r?.strengths ?? ""} className="input" /></Field>
          <Field label="مجالات التحسين"><textarea name="improvements" rows={4} defaultValue={r?.improvements ?? ""} className="input" /></Field>
          <Field label="الأهداف للفترة القادمة"><textarea name="goals" rows={4} defaultValue={r?.goals ?? ""} className="input" /></Field>
        </section>
        <label className="card p-4 flex items-center gap-2 text-sm">
          <input type="checkbox" name="submitToEmployee" className="size-4 accent-brand-600" />
          <span><b>إرسال التقييم للموظف</b> — لا يمكن التعديل بعد الإرسال (اتركه دون تحديد للحفظ كمسودة)</span>
        </label>
      </ActionForm>
    </div>
  );
}
