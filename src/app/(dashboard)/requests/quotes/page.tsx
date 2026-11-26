import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import SearchBox from "@/components/ui/SearchBox";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatSAR } from "@/lib/format";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_STYLES, quoteNumber, quoteView } from "@/lib/quotes";
import { currentMonthKey, monthBounds, riyadhToday } from "@/lib/time";
import { daysText } from "@/lib/clients";

type SP = { q?: string; status?: string };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("requests");
  const sp = await searchParams;
  const status = sp.status ?? "open";
  const today = riyadhToday();

  const and: Prisma.QuoteWhereInput[] = [];
  if (sp.q) {
    const n = Number(sp.q.replace(/\D/g, ""));
    and.push({ OR: [
      { title: { contains: sp.q, mode: "insensitive" } },
      { client: { name: { contains: sp.q, mode: "insensitive" } } },
      { company: { name: { contains: sp.q, mode: "insensitive" } } },
      ...(n ? [{ number: n }] : []),
    ] });
  }
  const pending: Prisma.QuoteWhereInput = { status: { in: ["DRAFT", "SENT"] } };
  if (status === "open") and.push({ ...pending, validUntil: { gte: today } });
  if (status === "expired") and.push({ ...pending, validUntil: { lt: today } });
  if (status === "accepted") and.push({ status: "ACCEPTED" });
  if (status === "closed") and.push({ status: { in: ["REJECTED", "CANCELLED"] } });

  const { start, end } = monthBounds(currentMonthKey());
  const [quotes, openAgg, acceptedAgg, expiredCount] = await Promise.all([
    db.quote.findMany({
      where: { AND: and },
      include: { client: { select: { name: true } }, company: { select: { name: true } } },
      orderBy: { number: "desc" },
      take: 300,
    }),
    db.quote.aggregate({ where: { ...pending, validUntil: { gte: today } }, _count: { _all: true }, _sum: { total: true } }),
    db.quote.aggregate({ where: { status: "ACCEPTED", decidedAt: { gte: start, lt: end } }, _count: { _all: true }, _sum: { total: true } }),
    db.quote.count({ where: { ...pending, validUntil: { lt: today } } }),
  ]);

  const kpis = [
    { label: "عروض سارية بانتظار الرد", value: openAgg._count._all, note: formatSAR(openAgg._sum?.total ?? 0) },
    { label: "عروض مقبولة هذا الشهر", value: acceptedAgg._count._all, note: formatSAR(acceptedAgg._sum?.total ?? 0) },
    { label: "عروض انتهت صلاحيتها دون رد", value: expiredCount, note: expiredCount ? "تحتاج متابعة أو تجديد" : "لا توجد" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="عروض الأسعار"
        crumbs={[{ label: "المعاملات", href: "/requests/all" }, { label: "عروض الأسعار" }]}
        actions={can(user, "requests", "EDIT") && <Link href="/requests/quotes/new" className="btn-primary"><Plus size={16} /> عرض سعر جديد</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="card-dark p-4">
            <div className="text-sm text-navy-100">{k.label}</div>
            <div className="stat-value text-white">{k.value}</div>
            <div className="text-xs font-semibold text-gold-300">{k.note}</div>
          </div>
        ))}
      </div>

      <SearchBox placeholder="رقم العرض، العنوان، العميل، الشركة" defaultValue={sp.q}>
        <select name="status" defaultValue={status} className="input w-auto">
          <option value="open">السارية</option>
          <option value="expired">منتهية الصلاحية</option>
          <option value="accepted">المقبولة</option>
          <option value="closed">المرفوضة / الملغاة</option>
          <option value="all">الكل</option>
        </select>
      </SearchBox>

      <p className="text-sm text-neutral-500">{quotes.length} عرض</p>
      <div className="card overflow-x-auto">
        <table className="table min-w-[860px]">
          <thead>
            <tr><th>الرقم</th><th>العنوان</th><th>العميل / الشركة</th><th>التاريخ</th><th>صالح حتى</th><th>الإجمالي شامل الضريبة</th><th>الحالة</th></tr>
          </thead>
          <tbody>
            {quotes.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-neutral-500">لا توجد عروض أسعار</td></tr>}
            {quotes.map((q) => {
              const v = quoteView(q);
              const left = Math.round((q.validUntil.getTime() - today.getTime()) / 86400000);
              return (
                <tr key={q.id} className="hover:bg-neutral-50">
                  <td dir="ltr" className="text-right font-semibold whitespace-nowrap"><Link href={`/requests/quotes/${q.id}`} className="link">{quoteNumber(q.number)}</Link></td>
                  <td>{q.title}</td>
                  <td>{q.client.name}{q.company && <div className="text-xs text-neutral-500">{q.company.name}</div>}</td>
                  <td className="whitespace-nowrap">{formatDate(q.issueDate)}</td>
                  <td className="whitespace-nowrap">
                    {formatDate(q.validUntil)}
                    {(v === "DRAFT" || v === "SENT") && <div className={`text-xs ${left <= 2 ? "font-semibold text-amber-700" : "text-neutral-500"}`}>{left === 0 ? "ينتهي اليوم" : `متبقٍ ${daysText(left)}`}</div>}
                  </td>
                  <td className="whitespace-nowrap font-semibold">{formatSAR(q.total)}</td>
                  <td><Badge className={QUOTE_STATUS_STYLES[v]}>{QUOTE_STATUS_LABELS[v]}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
