import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import EmployeeAvatar from "@/components/EmployeeAvatar";
import RequestForm from "@/components/RequestForm";
import RequestsTable, { REQUEST_INCLUDE } from "@/components/RequestsTable";
import ActionForm from "@/components/ui/ActionForm";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { LEAVE_TYPE_LABELS, REQUEST_STATUS_LABELS, annualBalance, pendingForWhere } from "@/lib/leave";
import { DAY_MS, dateKey, riyadhToday } from "@/lib/time";
import { updateCarryover } from "../leave-actions";

type SP = { tab?: string; status?: string; type?: string; q?: string };

export default async function LeavesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const canView = can(user, "employees", "VIEW");
  const canEdit = can(user, "employees", "EDIT");
  // المدير المباشر يدخل الصفحة دي حتى لو ملوش صلاحية على قسم الموظفين
  const isLineManager = !!user.employeeId && (await db.employee.count({ where: { managerId: user.employeeId } })) > 0;
  if (!canView && !isLineManager) redirect("/");

  const scope: Prisma.LeaveRequestWhereInput = canView ? {} : { employee: { managerId: user.employeeId } };
  const pendingCount = await db.leaveRequest.count({ where: pendingForWhere(user) });
  const tabs = [
    { key: "pending", label: "بانتظار موافقتي", count: pendingCount },
    { key: "all", label: "جميع الطلبات" },
    { key: "away", label: "من في إجازة" },
    ...(canEdit ? [{ key: "balances", label: "أرصدة الإجازات" }] : []),
  ];
  const tab = tabs.some((t) => t.key === sp.tab) ? sp.tab! : "pending";
  const today = riyadhToday();

  return (
    <div className="space-y-6">
      <PageHeader title="الإجازات والأذونات" crumbs={[{ label: "الموظفين", href: "/employees/profiles" }, { label: "الإجازات والأذونات" }]} />
      {canEdit && (
        <Collapsible label="تسجيل طلب نيابةً عن موظف">
          <RequestForm leaveTypes={Object.entries(LEAVE_TYPE_LABELS)} today={dateKey(today)}
            employees={await db.employee.findMany({ where: { status: { not: "TERMINATED" } }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } })} />
        </Collapsible>
      )}
      <Tabs base="/employees/leaves" current={tab} tabs={tabs} />
      {tab === "pending" && <Pending />}
      {tab === "all" && <All />}
      {tab === "away" && <Away />}
      {tab === "balances" && canEdit && <Balances />}
    </div>
  );

  async function Pending() {
    const rows = await db.leaveRequest.findMany({ where: pendingForWhere(user), include: REQUEST_INCLUDE, orderBy: { startDate: "asc" } });
    return rows.length === 0 ? <div className="card p-10 text-center text-neutral-500">لا توجد طلبات بانتظار موافقتك ✅</div> : <RequestsTable rows={rows} user={user} />;
  }

  async function All() {
    const where: Prisma.LeaveRequestWhereInput = {
      ...scope,
      ...(sp.status ? { status: sp.status as never } : {}),
      ...(sp.type === "PERMISSION" ? { kind: "PERMISSION" } : sp.type ? { type: sp.type as never } : {}),
      ...(sp.q ? { employee: { ...(scope.employee as object), fullName: { contains: sp.q, mode: "insensitive" } } } : {}),
    };
    const rows = await db.leaveRequest.findMany({ where, include: REQUEST_INCLUDE, orderBy: { createdAt: "desc" }, take: 200 });
    return (
      <div className="space-y-4">
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="tab" value="all" />
          <input name="q" defaultValue={sp.q} placeholder="اسم الموظف" className="input w-56" />
          <select name="status" defaultValue={sp.status ?? ""} className="input w-auto">
            <option value="">جميع الحالات</option>
            {Object.entries(REQUEST_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select name="type" defaultValue={sp.type ?? ""} className="input w-auto">
            <option value="">جميع الأنواع</option>
            {Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            <option value="PERMISSION">استئذان</option>
          </select>
          <button className="btn-secondary">عرض</button>
        </form>
        <RequestsTable rows={rows} user={user} />
      </div>
    );
  }

  async function Away() {
    const horizon = new Date(today.getTime() + 30 * DAY_MS);
    const rows = await db.leaveRequest.findMany({
      where: { ...scope, kind: "LEAVE", status: "APPROVED", endDate: { gte: today }, startDate: { lte: horizon } },
      include: { employee: { select: { id: true, fullName: true, jobTitle: true } } }, orderBy: { startDate: "asc" },
    });
    const now = rows.filter((r) => r.startDate <= today);
    const soon = rows.filter((r) => r.startDate > today);
    const List = ({ items, empty }: { items: typeof rows; empty: string }) => items.length === 0 ? <p className="p-4 text-sm text-neutral-500">{empty}</p> : (
      <ul className="divide-y divide-neutral-100">
        {items.map((r) => (
          <li key={r.id}>
            <Link href={`/employees/profiles/${r.employee.id}`} className="flex items-center gap-3 p-3 hover:bg-neutral-50">
              <EmployeeAvatar name={r.employee.fullName} size="sm" />
              <div className="flex-1 min-w-0"><div className="text-sm font-medium">{r.employee.fullName}</div><div className="text-xs text-neutral-500">{r.employee.jobTitle}</div></div>
              <div className="text-left text-xs"><div>{r.type ? LEAVE_TYPE_LABELS[r.type] : "إجازة"}</div><div className="text-neutral-500">{formatDate(r.startDate)} ← {formatDate(r.endDate)}</div></div>
            </Link>
          </li>
        ))}
      </ul>
    );
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card"><h2 className="p-4 font-semibold border-b border-neutral-100">في إجازة اليوم ({now.length})</h2><List items={now} empty="لا أحد في إجازة اليوم" /></section>
        <section className="card"><h2 className="p-4 font-semibold border-b border-neutral-100">إجازات خلال 30 يوماً ({soon.length})</h2><List items={soon} empty="لا توجد إجازات قادمة" /></section>
      </div>
    );
  }

  async function Balances() {
    const emps = await db.employee.findMany({ where: { status: { not: "TERMINATED" } }, orderBy: { fullName: "asc" } });
    const rows = await Promise.all(emps.map(async (e) => ({ e, b: await annualBalance(e) })));
    const canManage = can(user, "employees", "MANAGE");
    return (
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>الموظف</th><th>الاستحقاق</th><th>المستحق هذا العام</th><th>المرحّل</th><th>المستخدم</th><th>بانتظار الموافقة</th><th>المتبقي</th></tr></thead>
          <tbody>
            {rows.map(({ e, b }) => (
              <tr key={e.id}>
                <td><Link href={`/employees/profiles/${e.id}`} className="link">{e.fullName}</Link></td>
                <td>{b.entitlement}</td><td>{b.accrued}</td>
                <td>
                  {canManage ? (
                    <ActionForm action={updateCarryover} submitLabel="حفظ" resetOnSuccess={false} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={e.id} />
                      <input name="leaveCarryover" type="number" min={0} max={365} defaultValue={e.leaveCarryover} className="input w-20 !py-1" />
                    </ActionForm>
                  ) : b.carryover}
                </td>
                <td>{b.used}</td><td>{b.pending}</td>
                <td className={`font-bold ${b.remaining < 0 ? "text-rose-600" : "text-brand-800"}`}>{b.remaining}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
