import Link from "next/link";
import { redirect } from "next/navigation";
import EmployeeAvatar from "@/components/EmployeeAvatar";
import PageHeader from "@/components/ui/PageHeader";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { REVIEW_STATUS_LABELS, currentPeriod, periodLabel, periodOptions, rating } from "@/lib/performance";

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requireUser();
  const isLineManager = !!user.employeeId && (await db.employee.count({ where: { managerId: user.employeeId } })) > 0;
  const canView = can(user, "employees", "VIEW");
  if (!canView && !isLineManager) redirect("/");
  const period = periodOptions().includes((await searchParams).period ?? "") ? (await searchParams).period! : currentPeriod();

  const emps = await db.employee.findMany({
    where: { status: { not: "TERMINATED" }, ...(canView ? {} : { managerId: user.employeeId }), ...(user.employeeId ? { id: { not: user.employeeId } } : {}) },
    include: { reviews: { where: { period } }, manager: { select: { userId: true, fullName: true } }, position: { select: { title: true } } },
    orderBy: { fullName: "asc" },
  });
  const done = emps.filter((e) => e.reviews[0] && e.reviews[0].status !== "DRAFT");
  const avg = done.length ? done.reduce((a, e) => a + e.reviews[0].overall, 0) / done.length : null;
  const mayReview = (e: (typeof emps)[number]) => e.manager?.userId === user.id || can(user, "employees", "EDIT");

  return (
    <div className="space-y-6">
      <PageHeader title="تقييم الأداء" crumbs={[{ label: "الموظفين", href: "/employees/profiles" }, { label: "تقييم الأداء" }]} />
      <form className="flex flex-wrap items-end gap-2">
        <label className="text-sm space-y-1"><span className="block text-neutral-600">فترة التقييم</span>
          <select name="period" defaultValue={period} className="input w-auto">{periodOptions().map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}</select></label>
        <button className="btn-secondary">عرض</button>
      </form>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[["الموظفون", emps.length], ["تم تقييمهم", done.length], ["بانتظار التقييم", emps.length - done.length], ["متوسط الأداء", avg === null ? "—" : avg.toFixed(2)]].map(([l, v]) => (
          <div key={l as string} className="card p-4"><div className="text-2xl font-bold">{v}</div><div className="text-sm text-neutral-500">{l}</div></div>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>الموظف</th><th>المدير المباشر</th><th>الحالة</th><th>الدرجة</th><th>التقدير</th><th></th></tr></thead>
          <tbody>
            {emps.map((e) => {
              const r = e.reviews[0];
              const rt = r && r.status !== "DRAFT" ? rating(r.overall) : null;
              return (
                <tr key={e.id}>
                  <td><div className="flex items-center gap-2"><EmployeeAvatar name={e.fullName} size="sm" /><div>
                    <div className="font-medium">{e.fullName}</div><div className="text-xs text-neutral-500">{e.position?.title ?? e.jobTitle}</div></div></div></td>
                  <td className="text-sm">{e.manager?.fullName ?? "—"}</td>
                  <td className="text-xs">{r ? REVIEW_STATUS_LABELS[r.status] : <span className="text-neutral-400">لم يبدأ</span>}</td>
                  <td className="font-bold">{rt ? r!.overall.toFixed(2) : "—"}</td>
                  <td>{rt && <span className={`rounded-full px-2.5 py-0.5 text-xs ${rt.cls}`}>{rt.label}</span>}</td>
                  <td className="text-left">
                    {(mayReview(e) || r) && (
                      <Link href={`/employees/performance/review?employee=${e.id}&period=${period}`} className={r && r.status !== "DRAFT" ? "link text-sm" : "btn-primary !py-1 !text-xs"}>
                        {r && r.status !== "DRAFT" ? "عرض" : r ? "إكمال التقييم" : "تقييم"}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {emps.length === 0 && <tr><td colSpan={6} className="text-center text-neutral-500 py-8">لا يوجد موظفون للتقييم</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
