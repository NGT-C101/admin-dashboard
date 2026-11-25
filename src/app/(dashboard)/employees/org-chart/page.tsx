import Link from "next/link";
import EmployeeAvatar from "@/components/EmployeeAvatar";
import PageHeader from "@/components/ui/PageHeader";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";

type Node = { id: string; fullName: string; jobTitle: string; orgDepartment: string | null; managerId: string | null; status: string };

function Card({ n }: { n: Node }) {
  return (
    <Link href={`/employees/profiles/${n.id}`}
      className="inline-flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm hover:ring-2 hover:ring-brand-600/25 min-w-56">
      <EmployeeAvatar name={n.fullName} size="sm" />
      <div className="text-right min-w-0">
        <div className="text-sm font-semibold truncate">{n.fullName}</div>
        <div className="text-xs text-neutral-500 truncate">{n.jobTitle}{n.orgDepartment ? ` · ${n.orgDepartment}` : ""}</div>
        {n.status === "ON_LEAVE" && <div className="text-[11px] text-sky-700">في إجازة</div>}
      </div>
    </Link>
  );
}

function Branch({ node, tree }: { node: Node; tree: Map<string | null, Node[]> }) {
  const kids = tree.get(node.id) ?? [];
  return (
    <li className="relative">
      <Card n={node} />
      {kids.length > 0 && (
        <ul className="mr-7 mt-3 space-y-3 border-r-2 border-brand-200 pr-6">
          {kids.map((k) => (
            <div key={k.id} className="relative before:absolute before:-right-6 before:top-6 before:h-0.5 before:w-6 before:bg-brand-200">
              <Branch node={k} tree={tree} />
            </div>
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function OrgChartPage() {
  await requireSection("employees");
  const all = await db.employee.findMany({
    where: { status: { not: "TERMINATED" } },
    select: { id: true, fullName: true, jobTitle: true, orgDepartment: true, managerId: true, status: true },
    orderBy: { fullName: "asc" },
  });
  const ids = new Set(all.map((e) => e.id));
  const children = new Map<string | null, Node[]>();
  for (const e of all) {
    const parent = e.managerId && ids.has(e.managerId) ? e.managerId : null;
    children.set(parent, [...(children.get(parent) ?? []), e]);
  }
  const roots = children.get(null) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="الهيكل التنظيمي" crumbs={[{ label: "الموظفين", href: "/employees/profiles" }, { label: "الهيكل التنظيمي" }]} />
      <p className="text-sm text-neutral-600">يُبنى الهيكل تلقائياً من «المدير المباشر» في ملف كل موظف.</p>
      {all.length === 0 ? <div className="card p-12 text-center text-neutral-500">لا يوجد موظفون مسجّلون بعد</div> : (
        <div className="card p-6 overflow-x-auto">
          <ul className="space-y-5 min-w-max">
            {roots.map((r) => <Branch key={r.id} node={r} tree={children} />)}
          </ul>
        </div>
      )}
    </div>
  );
}
