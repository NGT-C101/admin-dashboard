import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import SearchBox from "@/components/ui/SearchBox";
import TransactionsTable, { TX_INCLUDE } from "@/components/TransactionsTable";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";

type SP = { q?: string; stage?: string; entity?: string; service?: string; assignee?: string; status?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("requests");
  const sp = await searchParams;
  const status = sp.status ?? "open";

  const and: Prisma.TransactionWhereInput[] = [];
  if (sp.q) {
    const n = Number(sp.q.replace(/\D/g, ""));
    and.push({ OR: [
      { title: { contains: sp.q, mode: "insensitive" } },
      { platformRef: { contains: sp.q } },
      { company: { name: { contains: sp.q, mode: "insensitive" } } },
      { company: { crNumber: { contains: sp.q } } },
      { company: { client: { name: { contains: sp.q, mode: "insensitive" } } } },
      ...(n ? [{ number: n }] : []),
    ] });
  }
  if (sp.stage) and.push({ stageId: sp.stage });
  if (sp.entity) and.push({ govEntityId: sp.entity });
  if (sp.service) and.push({ serviceTypeId: sp.service });
  if (sp.assignee === "me") and.push({ assigneeId: user.id });
  else if (sp.assignee) and.push({ assigneeId: sp.assignee });
  if (status === "open") and.push({ stage: { kind: "OPEN" } });
  if (status === "closed") and.push({ stage: { kind: { not: "OPEN" } } });
  if (status === "overdue") and.push({ stage: { kind: "OPEN" }, dueDate: { lt: new Date() } });

  const [transactions, stages, entities, services, users] = await Promise.all([
    db.transaction.findMany({ where: { AND: and }, include: TX_INCLUDE, orderBy: { createdAt: "desc" }, take: 300 }),
    db.stage.findMany({ orderBy: { order: "asc" } }),
    db.govEntity.findMany({ orderBy: { order: "asc" } }),
    db.serviceType.findMany({ orderBy: { order: "asc" } }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const sel = (name: keyof SP, label: string, opts: { id: string; name: string }[], extra?: React.ReactNode) => (
    <select name={name} defaultValue={sp[name] ?? ""} className="input w-auto">
      <option value="">{label}</option>
      {extra}
      {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="المعاملات"
        crumbs={[{ label: "المعاملات" }]}
        actions={<Link href="/requests/all/new" className="btn-primary"><Plus size={16} /> معاملة جديدة</Link>}
      />

      <SearchBox placeholder="رقم المعاملة، العنوان، الشركة، العميل، السجل، رقم المنصة" defaultValue={sp.q}>
        <select name="status" defaultValue={status} className="input w-auto">
          <option value="open">الجارية</option>
          <option value="overdue">المتأخرة</option>
          <option value="closed">المنتهية / الملغاة</option>
          <option value="all">الكل</option>
        </select>
        {sel("stage", "كل المراحل", stages)}
        {sel("entity", "كل الجهات", entities)}
        {sel("service", "كل الخدمات", services)}
        {sel("assignee", "كل الموظفين", users, <option value="me">معاملاتي أنا</option>)}
      </SearchBox>

      <p className="text-sm text-slate-500">{transactions.length} معاملة</p>
      <TransactionsTable transactions={transactions} showCompany />
    </div>
  );
}
