import { redirect } from "next/navigation";
import AttendanceWidget from "@/components/AttendanceWidget";
import LeaveBalanceCard from "@/components/LeaveBalanceCard";
import MonthAttendance from "@/components/MonthAttendance";
import RequestForm from "@/components/RequestForm";
import RequestsTable, { REQUEST_INCLUDE } from "@/components/RequestsTable";
import PageHeader from "@/components/ui/PageHeader";
import ActionForm from "@/components/ui/ActionForm";
import { Field } from "@/components/ui/Field";
import ReviewView from "@/components/ReviewView";
import { acknowledgeReview } from "../employees/review-actions";
import { periodLabel, rating } from "@/lib/performance";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LEAVE_TYPE_LABELS } from "@/lib/leave";
import { currentMonthKey, dateKey, monthLabel, riyadhToday } from "@/lib/time";
import { formatSAR } from "@/lib/format";
import Link from "next/link";
import CustodyList, { CUSTODY_INCLUDE } from "@/components/CustodyList";

export default async function MyServicesPage() {
  const user = await requireUser();
  if (!user.employeeId) redirect("/");
  const e = await db.employee.findUnique({ where: { id: user.employeeId } });
  if (!e) redirect("/");
  const [requests, slips, reviews, custodies] = await Promise.all([
    db.leaveRequest.findMany({ where: { employeeId: e.id }, include: REQUEST_INCLUDE, orderBy: { createdAt: "desc" }, take: 30 }),
    db.payslip.findMany({ where: { employeeId: e.id, run: { status: { not: "DRAFT" } } }, include: { run: { select: { month: true } } }, orderBy: { run: { month: "desc" } }, take: 12 }),
    db.performanceReview.findMany({ where: { employeeId: e.id, status: { not: "DRAFT" } }, include: { reviewer: { select: { name: true } } }, orderBy: { periodStart: "desc" } }),
    db.custody.findMany({ where: { employeeId: e.id }, include: CUSTODY_INCLUDE, orderBy: { assignedAt: "desc" } }),
  ]);
  const toAck = reviews.filter((r) => r.status === "SUBMITTED");

  return (
    <div className="space-y-6">
      <PageHeader title="خدماتي" crumbs={[{ label: "الخدمات الذاتية" }]} />
      {e.status !== "TERMINATED" && <AttendanceWidget employeeId={e.id} />}
      {toAck.map((r) => (
        <section key={r.id} className="space-y-3 rounded-2xl border-2 border-brand-600/30 p-4">
          <h2 className="text-lg font-semibold">📋 تقييم أداء جديد بانتظار اطلاعك</h2>
          <ReviewView r={r} reviewerName={r.reviewer.name} />
          <div className="card p-4">
            <ActionForm action={acknowledgeReview} submitLabel="تأكيد الاطلاع على التقييم">
              <input type="hidden" name="id" value={r.id} />
              <Field label="تعليقك (اختياري)"><textarea name="comment" rows={2} className="input" /></Field>
            </ActionForm>
          </div>
        </section>
      ))}
      {custodies.some((c) => c.status === "PENDING") && <CustodyList custodies={custodies.filter((c) => c.status === "PENDING")} employeeName={e.fullName} selfService />}
      <LeaveBalanceCard employee={e} />
      <section className="card p-5">
        <h2 className="font-semibold mb-4">طلب جديد</h2>
        <RequestForm leaveTypes={Object.entries(LEAVE_TYPE_LABELS)} today={dateKey(riyadhToday())} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">طلباتي</h2>
        <RequestsTable rows={requests} user={user} showEmployee={false} />
      </section>
      {slips.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">قسائم رواتبي</h2>
          <div className="card divide-y divide-neutral-100">
            {slips.map((s) => (
              <Link key={s.id} href={`/employees/payroll/slip/${s.id}`} className="flex items-center justify-between p-3 hover:bg-neutral-50">
                <span className="font-medium">{monthLabel(s.run.month)}</span>
                <span className="font-bold text-brand-800">{formatSAR(s.net)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {reviews.some((r) => r.status === "ACKNOWLEDGED") && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">تقييمات أدائي</h2>
          <div className="card divide-y divide-neutral-100">
            {reviews.filter((r) => r.status === "ACKNOWLEDGED").map((r) => (
              <Link key={r.id} href={`/employees/performance/review?employee=${e.id}&period=${r.period}`} className="flex items-center justify-between p-3 hover:bg-neutral-50">
                <span className="font-medium">{periodLabel(r.period)}</span>
                <span className="flex items-center gap-2"><b>{r.overall.toFixed(2)}</b><span className={`rounded-full px-2.5 py-0.5 text-xs ${rating(r.overall).cls}`}>{rating(r.overall).label}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {custodies.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">عُهدي</h2>
          <CustodyList custodies={custodies} employeeName={e.fullName} />
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">سجل حضوري هذا الشهر</h2>
        <MonthAttendance employee={e} month={currentMonthKey()} />
      </section>
    </div>
  );
}
