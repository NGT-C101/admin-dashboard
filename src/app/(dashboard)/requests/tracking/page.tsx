import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { TX_INCLUDE, isOverdue } from "@/components/TransactionsTable";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, txNumber } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import { PRIORITY_LABELS, PRIORITY_STYLES, visibleTxWhere } from "@/lib/transactions";

// لوحة متابعة: كل مرحلة عمود، وفيه المعاملات الجارية
export default async function TrackingPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const user = await requireSection("requests");
  const { mine } = await searchParams;

  const stages = await db.stage.findMany({
    where: { kind: "OPEN" },
    orderBy: { order: "asc" },
    include: {
      transactions: {
        where: { ...visibleTxWhere(user), ...(mine && { assigneeId: user.id }) },
        include: TX_INCLUDE,
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      },
    },
  });
  const visible = stages.filter((s) => s.active || s.transactions.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="لوحة المتابعة"
        crumbs={[{ label: "المعاملات", href: "/requests/all" }, { label: "لوحة المتابعة" }]}
        actions={
          <Link href={mine ? "/requests/tracking" : "/requests/tracking?mine=1"} className="btn-secondary">
            {mine ? "عرض كل المعاملات" : "معاملاتي فقط"}
          </Link>
        }
      />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {visible.map((s) => (
          <div key={s.id} className="w-64 shrink-0 rounded-xl bg-neutral-200/60 p-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-semibold">{s.name}</h2>
              <span className="text-xs rounded-full bg-white px-2 py-0.5">{s.transactions.length}</span>
            </div>
            <div className="space-y-2">
              {s.transactions.map((t) => (
                <Link key={t.id} href={`/requests/all/${t.id}`}
                  className={`block rounded-lg bg-white p-3 shadow-sm hover:ring-2 hover:ring-brand-600/30 ${isOverdue(t) ? "border-r-4 border-rose-500" : ""}`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs text-neutral-500" dir="ltr">{txNumber(t.number)}</span>
                    {t.priority !== "NORMAL" && <Badge className={PRIORITY_STYLES[t.priority]}>{PRIORITY_LABELS[t.priority]}</Badge>}
                  </div>
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-neutral-500 mt-1">{t.company.name}</div>
                  <div className="flex justify-between text-xs mt-2 text-neutral-500">
                    <span>{t.assignee?.name ?? "—"}{t.assignee && !t.acceptedAt && <span className="block text-amber-700">بانتظار الاستلام</span>}</span>
                    <span className={isOverdue(t) ? "text-rose-600 font-semibold" : ""}>{formatDate(t.dueDate)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
