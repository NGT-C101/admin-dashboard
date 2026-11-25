import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import ContractsTable, { CONTRACT_INCLUDE } from "@/components/ContractsTable";
import PageHeader from "@/components/ui/PageHeader";
import SearchBox from "@/components/ui/SearchBox";
import { requireSection } from "@/lib/auth";
import { CONTRACT_TYPE_LABELS, inDays } from "@/lib/clients";
import { db } from "@/lib/db";
import { formatSAR } from "@/lib/format";

type SP = { q?: string; status?: string; type?: string };

export default async function ContractsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSection("clients");
  const sp = await searchParams;
  const status = sp.status ?? "active";
  const now = new Date();
  const live: Prisma.ContractWhereInput = { cancelledAt: null, startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }] };

  const and: Prisma.ContractWhereInput[] = [];
  if (sp.q) and.push({ OR: [
    { title: { contains: sp.q, mode: "insensitive" } },
    { client: { name: { contains: sp.q, mode: "insensitive" } } },
    { company: { name: { contains: sp.q, mode: "insensitive" } } },
  ] });
  if (sp.type) and.push({ type: sp.type as never });
  if (status === "active") and.push(live);
  if (status === "ending") and.push({ cancelledAt: null, endDate: { gte: now, lte: inDays(30) } });
  if (status === "expired") and.push({ cancelledAt: null, endDate: { lt: now } });
  if (status === "cancelled") and.push({ cancelledAt: { not: null } });

  const [contracts, activeCount, endingCount, monthly] = await Promise.all([
    db.contract.findMany({ where: { AND: and }, include: CONTRACT_INCLUDE, orderBy: [{ endDate: { sort: "asc", nulls: "last" } }], take: 300 }),
    db.contract.count({ where: live }),
    db.contract.count({ where: { cancelledAt: null, endDate: { gte: now, lte: inDays(30) } } }),
    db.contract.aggregate({ where: { ...live, type: "MONTHLY" }, _sum: { value: true } }),
  ]);

  const stats = [
    { label: "عقود سارية", value: activeCount },
    { label: "تنتهي خلال 30 يوم", value: endingCount, alert: endingCount > 0, href: "?status=ending" },
    { label: "دخل الباقات الشهرية", value: formatSAR(monthly._sum.value ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="العقود والاتفاقيات" crumbs={[{ label: "العملاء", href: "/clients/directory" }, { label: "العقود" }]}
        actions={<Link href="/clients/contracts/new" className="btn-primary"><Plus size={16} /> عقد جديد</Link>} />
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => {
          const inner = (
            <div className={`card p-5 ${s.href ? "hover:ring-2 hover:ring-brand-600/20" : ""}`}>
              <div className={`text-2xl font-bold ${s.alert ? "text-amber-600" : ""}`}>{s.value}</div>
              <div className="text-sm text-neutral-500">{s.label}</div>
            </div>
          );
          return s.href ? <Link key={s.label} href={s.href}>{inner}</Link> : <div key={s.label}>{inner}</div>;
        })}
      </div>
      <SearchBox placeholder="ابحث بعنوان العقد أو العميل أو الشركة" defaultValue={sp.q}>
        <select name="status" defaultValue={status} className="input w-auto">
          <option value="active">السارية</option>
          <option value="ending">تنتهي خلال 30 يوم</option>
          <option value="expired">المنتهية</option>
          <option value="cancelled">الملغاة</option>
          <option value="all">الكل</option>
        </select>
        <select name="type" defaultValue={sp.type ?? ""} className="input w-auto">
          <option value="">كل الأنواع</option>
          {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </SearchBox>
      <ContractsTable contracts={contracts} showClient />
    </div>
  );
}
