import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { INTERACTION_INCLUDE, InteractionForm, InteractionList } from "@/components/InteractionsSection";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import { requireSection } from "@/lib/auth";
import { INTERACTION_TYPE_LABELS, endOfToday } from "@/lib/clients";
import { db } from "@/lib/db";

type SP = { view?: string; type?: string };

export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("clients");
  const sp = await searchParams;
  const view = sp.view ?? "mine";
  const today = endOfToday();

  const where: Prisma.InteractionWhereInput = {
    ...(sp.type ? { type: sp.type as never } : {}),
    ...(view === "mine" ? { assigneeId: user.id, followUpDone: false, followUpAt: { not: null } } : {}),
    ...(view === "due" ? { followUpDone: false, followUpAt: { not: null, lte: today } } : {}),
  };
  const [items, clients, users, myDue] = await Promise.all([
    db.interaction.findMany({
      where, include: INTERACTION_INCLUDE, take: 200,
      orderBy: view === "all" ? { occurredAt: "desc" } : { followUpAt: "asc" },
    }),
    db.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.interaction.count({ where: { assigneeId: user.id, followUpDone: false, followUpAt: { not: null, lte: today } } }),
  ]);

  const views = [["mine", `متابعاتي (${myDue} مستحقة)`], ["due", "كل المتابعات المستحقة"], ["all", "سجل التواصل الكامل"]];
  return (
    <div className="space-y-6">
      <PageHeader title="سجل التواصل والمتابعات" crumbs={[{ label: "العملاء", href: "/clients/directory" }, { label: "التواصل" }]} />
      <Collapsible label="تسجيل تواصل جديد">
        <InteractionForm clients={clients} users={users} />
      </Collapsible>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {views.map(([v, l]) => (
          <Link key={v} href={`?view=${v}${sp.type ? `&type=${sp.type}` : ""}`}
            className={`rounded-full px-3 py-1 ring-1 ${view === v ? "bg-brand-700 text-white ring-brand-700" : "bg-white ring-neutral-200 hover:bg-neutral-50"}`}>{l}</Link>
        ))}
        <form className="mr-auto flex gap-2">
          <input type="hidden" name="view" value={view} />
          <select name="type" defaultValue={sp.type ?? ""} className="input w-auto">
            <option value="">كل الأنواع</option>
            {Object.entries(INTERACTION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn-secondary">عرض</button>
        </form>
      </div>
      <InteractionList items={items} user={user} showClient />
    </div>
  );
}
