import { redirect } from "next/navigation";
import AttendanceWidget from "@/components/AttendanceWidget";
import LeaveBalanceCard from "@/components/LeaveBalanceCard";
import MonthAttendance from "@/components/MonthAttendance";
import RequestForm from "@/components/RequestForm";
import RequestsTable, { REQUEST_INCLUDE } from "@/components/RequestsTable";
import PageHeader from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LEAVE_TYPE_LABELS } from "@/lib/leave";
import { currentMonthKey, dateKey, riyadhToday } from "@/lib/time";

export default async function MyServicesPage() {
  const user = await requireUser();
  if (!user.employeeId) redirect("/");
  const e = await db.employee.findUnique({ where: { id: user.employeeId } });
  if (!e) redirect("/");
  const requests = await db.leaveRequest.findMany({ where: { employeeId: e.id }, include: REQUEST_INCLUDE, orderBy: { createdAt: "desc" }, take: 30 });

  return (
    <div className="space-y-6">
      <PageHeader title="خدماتي" crumbs={[{ label: "الخدمات الذاتية" }]} />
      {e.status !== "TERMINATED" && <AttendanceWidget employeeId={e.id} />}
      <LeaveBalanceCard employee={e} />
      <section className="card p-5">
        <h2 className="font-semibold mb-4">طلب جديد</h2>
        <RequestForm leaveTypes={Object.entries(LEAVE_TYPE_LABELS)} today={dateKey(riyadhToday())} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">طلباتي</h2>
        <RequestsTable rows={requests} user={user} showEmployee={false} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">سجل حضوري هذا الشهر</h2>
        <MonthAttendance employee={e} month={currentMonthKey()} />
      </section>
    </div>
  );
}
