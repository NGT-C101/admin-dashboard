import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BellRing, KeyRound, Phone, Plus, UserCheck, Users, Plane } from "lucide-react";
import AccessSummary from "@/components/AccessSummary";
import EmployeeAvatar from "@/components/EmployeeAvatar";
import HrAlertsList from "@/components/HrAlertsList";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import SearchBox from "@/components/ui/SearchBox";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_STYLES, serviceText } from "@/lib/hr";
import { getHrAlerts } from "@/lib/hr-alerts";

type SP = { q?: string; dept?: string; status?: string };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("employees");
  const sp = await searchParams;
  const status = sp.status ?? "current";

  const and: Prisma.EmployeeWhereInput[] = [];
  if (sp.q) and.push({ OR: [
    { fullName: { contains: sp.q, mode: "insensitive" } }, { fullNameEn: { contains: sp.q, mode: "insensitive" } },
    { jobTitle: { contains: sp.q, mode: "insensitive" } }, { phone: { contains: sp.q } },
    ...(can(user, "employees", "EDIT") ? [{ nationalId: { contains: sp.q } }] : []),
    ...(/\d/.test(sp.q) ? [{ number: Number(sp.q.replace(/\D/g, "")) || -1 }] : []),
  ] });
  if (sp.dept) and.push({ orgDepartment: sp.dept });
  if (status === "current") and.push({ status: { not: "TERMINATED" } });
  else if (status !== "all") and.push({ status: status as never });

  const [employees, depts, counts, alerts] = await Promise.all([
    db.employee.findMany({
      where: { AND: and }, orderBy: [{ status: "asc" }, { fullName: "asc" }],
      include: { user: { select: { role: true, active: true, permissions: true } }, manager: { select: { fullName: true } } },
    }),
    db.employee.findMany({ where: { orgDepartment: { not: null } }, select: { orgDepartment: true }, distinct: ["orgDepartment"] }),
    db.employee.groupBy({ by: ["status"], _count: true }),
    getHrAlerts(),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const stats = [
    { label: "على رأس العمل", value: count("ACTIVE"), icon: UserCheck },
    { label: "في إجازة", value: count("ON_LEAVE"), icon: Plane },
    { label: "إجمالي الموظفين الحاليين", value: count("ACTIVE") + count("ON_LEAVE") + count("SUSPENDED"), icon: Users },
    { label: "تنبيهات خلال 60 يوماً", value: alerts.length, icon: BellRing, alert: alerts.length > 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="سجل الموظفين" crumbs={[{ label: "الموظفين" }]}
        actions={can(user, "employees", "EDIT") && <Link href="/employees/profiles/new" className="btn-primary"><Plus size={16} /> إضافة موظف</Link>} />

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, alert }) => (
          <div key={label} className="card p-5 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${alert ? "bg-amber-50 text-amber-600" : "bg-brand-50 text-brand-700"}`}><Icon size={22} /></div>
            <div><div className="text-2xl font-bold">{value}</div><div className="text-sm text-neutral-500">{label}</div></div>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <details className="card" open={alerts.length <= 5}>
          <summary className="cursor-pointer select-none p-4 font-semibold flex items-center gap-2">
            <BellRing size={18} className="text-amber-600" /> تنبيهات الموارد البشرية ({alerts.length})
          </summary>
          <div className="border-t border-neutral-100"><HrAlertsList alerts={alerts} /></div>
        </details>
      )}

      <SearchBox placeholder="الاسم، المسمى الوظيفي، الجوال، الرقم الوظيفي" defaultValue={sp.q}>
        <select name="dept" defaultValue={sp.dept ?? ""} className="input w-auto">
          <option value="">جميع الإدارات</option>
          {depts.map((d) => <option key={d.orgDepartment} value={d.orgDepartment!}>{d.orgDepartment}</option>)}
        </select>
        <select name="status" defaultValue={status} className="input w-auto">
          <option value="current">الموظفون الحاليون</option>
          {Object.entries(EMPLOYEE_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          <option value="all">الكل</option>
        </select>
      </SearchBox>

      {employees.length === 0 ? (
        <div className="card p-12 text-center text-neutral-500">
          {sp.q || sp.dept ? "لا توجد نتائج مطابقة" : "لا يوجد موظفون مسجّلون بعد — ابدأ بإضافة أول موظف"}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {employees.map((e) => (
            <Link key={e.id} href={`/employees/profiles/${e.id}`}
              className={`card p-5 flex flex-col gap-4 hover:ring-2 hover:ring-brand-600/20 transition ${e.status === "TERMINATED" ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <EmployeeAvatar name={e.fullName} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{e.fullName}</div>
                  <div className="text-sm text-neutral-600 truncate">{e.jobTitle}</div>
                  {e.orgDepartment && <div className="text-xs text-neutral-500 truncate">{e.orgDepartment}</div>}
                </div>
                <Badge className={EMPLOYEE_STATUS_STYLES[e.status]}>{EMPLOYEE_STATUS_LABELS[e.status]}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 border-t border-neutral-100 pt-3">
                <div><span className="text-neutral-400">الرقم الوظيفي </span><span dir="ltr">EMP-{String(e.number).padStart(4, "0")}</span></div>
                <div><span className="text-neutral-400">مدة الخدمة </span>{serviceText(e.hireDate, e.terminationDate ?? undefined)}</div>
                {e.phone && <div className="flex items-center gap-1"><Phone size={12} /><span dir="ltr">{e.phone}</span></div>}
                {e.manager && <div className="truncate"><span className="text-neutral-400">المدير </span>{e.manager.fullName}</div>}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <KeyRound size={13} className="text-neutral-400 shrink-0" />
                {!e.user ? <span className="text-neutral-400">بدون حساب دخول</span>
                  : !e.user.active ? <span className="text-neutral-500">حساب الدخول موقوف</span>
                  : <AccessSummary isAdmin={e.user.role === "ADMIN"} perms={e.user.permissions} />}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
