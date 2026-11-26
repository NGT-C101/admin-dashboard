import Link from "next/link";
import { Crown, Trash2, UserX } from "lucide-react";
import EmployeeAvatar from "@/components/EmployeeAvatar";
import ActionForm from "@/components/ui/ActionForm";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { POSITION_LEVEL_LABELS, POSITION_LEVEL_STYLES } from "@/lib/positions";
import { assignHolder, deletePosition } from "../position-actions";
import PositionEditor from "@/components/PositionEditor";

type Pos = Awaited<ReturnType<typeof load>>[number];
const load = () => db.position.findMany({
  orderBy: [{ order: "asc" }, { title: "asc" }],
  include: { holder: { select: { id: true, fullName: true, jobTitle: true, phone: true } }, _count: { select: { children: true } } },
});

export default async function ManagementPage() {
  const user = await requireSection("employees");
  const canManage = can(user, "employees", "MANAGE");
  const [positions, employees] = await Promise.all([
    load(),
    db.employee.findMany({ where: { status: { not: "TERMINATED" } }, select: { id: true, fullName: true, jobTitle: true }, orderBy: { fullName: "asc" } }),
  ]);
  const byParent = new Map<string | null, Pos[]>();
  for (const p of positions) byParent.set(p.parentId, [...(byParent.get(p.parentId) ?? []), p]);
  const vacant = positions.filter((p) => !p.holderId).length;

  function Card({ p }: { p: Pos }) {
    const dark = p.level !== "DEPARTMENT";
    return (
      <div className={`rounded-xl bg-gradient-to-br ${POSITION_LEVEL_STYLES[p.level]} ${dark ? "" : "border border-neutral-200"} shadow-sm p-4 min-w-64 max-w-sm`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 font-bold">{p.level === "EXECUTIVE" && <Crown size={15} className="text-amber-300" />}{p.title}</div>
            {p.scope && <div className={`text-[11px] mt-0.5 ${dark ? "text-white/70" : "text-neutral-500"}`}>{p.scope}</div>}
          </div>
          {canManage && p._count.children === 0 && !p.holderId && (
            <form action={deletePosition}><input type="hidden" name="id" value={p.id} />
              <button title="حذف المنصب" className={dark ? "text-white/60 hover:text-white" : "text-neutral-400 hover:text-rose-600"}><Trash2 size={14} /></button></form>
          )}
        </div>
        <div className={`mt-3 rounded-lg p-2.5 ${dark ? "bg-white/10" : "bg-white border border-neutral-100"}`}>
          {p.holder ? (
            <Link href={`/employees/profiles/${p.holder.id}`} className="flex items-center gap-2">
              <EmployeeAvatar name={p.holder.fullName} size="sm" />
              <div className="min-w-0"><div className="text-sm font-semibold truncate">{p.holder.fullName}</div>
                {p.holder.phone && <div className={`text-[11px] ${dark ? "text-white/70" : "text-neutral-500"}`} dir="ltr">{p.holder.phone}</div>}</div>
            </Link>
          ) : <div className={`flex items-center gap-2 text-sm ${dark ? "text-white/80" : "text-amber-700"}`}><UserX size={16} /> المنصب شاغر</div>}
        </div>
        {canManage && (
          <ActionForm action={assignHolder} submitLabel="تعيين" resetOnSuccess={false} className="mt-2 flex items-center gap-1.5">
            <input type="hidden" name="positionId" value={p.id} />
            <select name="employeeId" defaultValue={p.holderId ?? ""} className="input !py-1 text-xs text-neutral-900 flex-1">
              <option value="">— شاغر —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
          </ActionForm>
        )}
      </div>
    );
  }

  function Tree({ parentId, depth = 0 }: { parentId: string | null; depth?: number }) {
    const kids = byParent.get(parentId) ?? [];
    if (!kids.length) return null;
    return (
      <ul className={depth ? "mr-8 mt-4 space-y-4 border-r-2 border-brand-200 pr-6" : "space-y-4"}>
        {kids.map((p) => (
          <li key={p.id} className={depth ? "relative before:absolute before:-right-6 before:top-8 before:h-0.5 before:w-6 before:bg-brand-200" : ""}>
            <Card p={p} />
            <Tree parentId={p.id} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="الإدارة والمناصب القيادية" crumbs={[{ label: "الموظفين", href: "/employees/profiles" }, { label: "الإدارة" }]} />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {(["EXECUTIVE", "SENIOR", "DEPARTMENT"] as const).map((l) => (
          <div key={l} className="card p-4"><div className="text-2xl font-bold">{positions.filter((p) => p.level === l).length}</div><div className="text-sm text-neutral-500">{POSITION_LEVEL_LABELS[l]}</div></div>
        ))}
        <div className="card p-4"><div className={`text-2xl font-bold ${vacant ? "text-amber-600" : "text-emerald-700"}`}>{vacant}</div><div className="text-sm text-neutral-500">مناصب شاغرة</div></div>
      </div>
      <p className="text-sm text-neutral-600">
        عند تعيين موظف في منصب، يُضبط مديره المباشر تلقائياً على شاغل المنصب الأعلى، ويظهر المنصب عند اختيار «المدير المباشر» في ملفات الموظفين.
      </p>
      <div className="card p-6 overflow-x-auto"><div className="min-w-max"><Tree parentId={null} /></div></div>

      {canManage && (
        <Collapsible label="إضافة منصب أو تعديله">
          <PositionEditor positions={positions.map(({ id, title, level, scope, parentId, order }) => ({ id, title, level, scope, parentId, order }))}
            levels={Object.entries(POSITION_LEVEL_LABELS)} />
        </Collapsible>
      )}
    </div>
  );
}
