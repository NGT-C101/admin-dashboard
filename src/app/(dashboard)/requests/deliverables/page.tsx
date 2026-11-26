import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { MessageCircle, Printer } from "lucide-react";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import SearchBox from "@/components/ui/SearchBox";
import Tabs from "@/components/ui/Tabs";
import { requireSection } from "@/lib/auth";
import { daysText } from "@/lib/clients";
import { db } from "@/lib/db";
import {
  CHANNEL_LABELS, CHANNEL_STYLES, awaitingDeliveryWhere, deliveryNumber, deliveryWhatsapp, itemLines,
} from "@/lib/deliveries";
import { formatDate, formatDateTime, txNumber } from "@/lib/format";
import { currentMonthKey, monthBounds } from "@/lib/time";
import { visibleTxWhere } from "@/lib/transactions";

type SP = { tab?: string; q?: string; mine?: string };
const LATE_DAYS = 3; // بعد هذه المدة من جاهزية المخرجات يُعدّ التسليم متأخراً

export default async function DeliverablesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("requests");
  const sp = await searchParams;
  const tab = sp.tab === "log" ? "log" : "pending";
  const mine = sp.mine === "1";
  const q = sp.q?.trim();
  const n = q ? Number(q.replace(/\D/g, "")) : 0;

  const txWhere: Prisma.TransactionWhereInput = {
    ...awaitingDeliveryWhere,
    AND: [visibleTxWhere(user)],
    ...(mine && { assigneeId: user.id }),
    ...(q && { OR: [
      { title: { contains: q, mode: "insensitive" } },
      { company: { name: { contains: q, mode: "insensitive" } } },
      { company: { client: { name: { contains: q, mode: "insensitive" } } } },
      ...(n ? [{ number: n }] : []),
    ] }),
  };
  const dlWhere: Prisma.DeliveryWhereInput = {
    transaction: visibleTxWhere(user),
    ...(mine && { deliveredById: user.id }),
    ...(q && { OR: [
      { recipientName: { contains: q, mode: "insensitive" } },
      { transaction: { title: { contains: q, mode: "insensitive" } } },
      { transaction: { company: { name: { contains: q, mode: "insensitive" } } } },
      { transaction: { company: { client: { name: { contains: q, mode: "insensitive" } } } } },
      ...(n ? [{ number: n }, { transaction: { number: n } }] : []),
    ] }),
  };

  const { start, end } = monthBounds(currentMonthKey());
  const [pending, pendingCount, monthCount, deliveries] = await Promise.all([
    tab === "pending"
      ? db.transaction.findMany({
          where: txWhere,
          include: {
            company: { select: { id: true, name: true, client: { select: { name: true } } } },
            assignee: { select: { name: true } },
            stage: { select: { name: true } },
            events: { where: { stage: { readyForDelivery: true } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
            _count: { select: { documents: true, deliveries: true } },
          },
          orderBy: { updatedAt: "asc" },
          take: 300,
        })
      : [],
    db.transaction.count({ where: awaitingDeliveryWhere }),
    db.delivery.count({ where: { deliveredAt: { gte: start, lt: end } } }),
    tab === "log"
      ? db.delivery.findMany({
          where: dlWhere,
          include: {
            transaction: { select: { id: true, number: true, title: true, company: { select: { name: true, client: { select: { name: true, phone: true } } } } } },
            documents: { select: { type: true, title: true } },
            deliveredBy: { select: { name: true } },
          },
          orderBy: { deliveredAt: "desc" },
          take: 300,
        })
      : [],
  ]);

  const now = Date.now();
  const rows = pending
    .map((t) => {
      const readyAt = t.events[0]?.createdAt ?? t.updatedAt;
      return { ...t, readyAt, waiting: Math.floor((now - readyAt.getTime()) / 86400000) };
    })
    .sort((a, b) => b.waiting - a.waiting);
  const late = tab === "pending" ? rows.filter((r) => r.waiting > LATE_DAYS).length : null;

  const kpis = [
    { label: "معاملات جاهزة بانتظار التسليم", value: pendingCount, note: pendingCount ? "تحتاج تسليماً للعميل" : "لا توجد" },
    { label: "تسليمات هذا الشهر", value: monthCount, note: "مسجّلة في المنصة" },
    ...(late !== null ? [{ label: `بانتظار التسليم أكثر من ${daysText(LATE_DAYS)}`, value: late, note: late ? "يرجى المتابعة مع العملاء" : "لا توجد" }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="تسليم المخرجات" crumbs={[{ label: "المعاملات", href: "/requests/all" }, { label: "تسليم المخرجات" }]} />

      <div className={`grid gap-3 ${kpis.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {kpis.map((k) => (
          <div key={k.label} className="card-dark p-4">
            <div className="text-sm text-navy-100">{k.label}</div>
            <div className="stat-value text-white">{k.value}</div>
            <div className="text-xs font-semibold text-gold-300">{k.note}</div>
          </div>
        ))}
      </div>

      <Tabs base="/requests/deliverables" current={tab} tabs={[
        { key: "pending", label: "بانتظار التسليم", count: pendingCount },
        { key: "log", label: "سجل التسليمات" },
      ]} />

      <SearchBox placeholder={tab === "log" ? "رقم التسليم أو المعاملة، المستلم، العميل، الشركة" : "رقم المعاملة، العنوان، العميل، الشركة"} defaultValue={q}>
        {tab === "log" && <input type="hidden" name="tab" value="log" />}
        <label className="flex items-center gap-2 rounded-xl bg-white px-3 text-sm">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="size-4 accent-brand-600" />
          {tab === "log" ? "تسليماتي فقط" : "معاملاتي فقط"}
        </label>
      </SearchBox>

      {tab === "pending" ? (
        <>
          <p className="text-sm text-neutral-500">المعاملات الموجودة في مرحلة «جاهزة للتسليم» (تُحدَّد من الإعدادات ← القوائم والمراحل)، والأقدم جاهزيةً أولاً. تخرج المعاملة من هذه القائمة عند نقلها إلى مرحلة مكتملة.</p>
          <div className="card overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr><th>الرقم</th><th>المعاملة</th><th>الشركة / العميل</th><th>المسؤول</th><th>جاهزة منذ</th><th>المخرجات المرفوعة</th><th></th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-neutral-500">لا توجد معاملات بانتظار التسليم</td></tr>}
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50">
                    <td dir="ltr" className="text-right font-semibold whitespace-nowrap"><Link href={`/requests/all/${t.id}`} className="link">{txNumber(t.number)}</Link></td>
                    <td>{t.title}<div className="text-xs text-neutral-500">{t.stage.name}</div></td>
                    <td><Link href={`/clients/companies/${t.company.id}`} className="hover:underline">{t.company.name}</Link><div className="text-xs text-neutral-500">{t.company.client.name}</div></td>
                    <td>{t.assignee?.name ?? <span className="text-neutral-400">غير محدد</span>}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(t.readyAt)}
                      <div className={`text-xs ${t.waiting > LATE_DAYS ? "font-semibold text-rose-600" : "text-neutral-500"}`}>
                        {t.waiting === 0 ? "اليوم" : `منذ ${daysText(t.waiting)}`}
                      </div>
                    </td>
                    <td>
                      {t._count.documents || <span className="text-amber-700">لا توجد</span>}
                      {t._count.deliveries > 0 && <div className="text-xs text-sky-700">سُلِّم جزئياً</div>}
                    </td>
                    <td><Link href={`/requests/all/${t.id}#delivery`} className="btn-secondary whitespace-nowrap text-xs">تسجيل التسليم</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-500">{deliveries.length} تسليم{deliveries.length === 300 && " (آخر 300)"}</p>
          <div className="card overflow-x-auto">
            <table className="table min-w-[920px]">
              <thead>
                <tr><th>رقم التسليم</th><th>التاريخ</th><th>المعاملة</th><th>المستلم</th><th>الطريقة</th><th>المخرجات</th><th>سلّمها</th><th></th></tr>
              </thead>
              <tbody>
                {deliveries.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-neutral-500">لا توجد تسليمات</td></tr>}
                {deliveries.map((d) => {
                  const t = d.transaction;
                  const count = d.documents.length + itemLines(d.items).length;
                  const wa = deliveryWhatsapp({
                    phone: d.recipientPhone ?? t.company.client.phone, clientName: t.company.client.name, companyName: t.company.name,
                    txTitle: t.title, txNo: t.number, note: d.note, documents: d.documents, items: d.items,
                  });
                  return (
                    <tr key={d.id} className="hover:bg-neutral-50">
                      <td dir="ltr" className="text-right font-semibold whitespace-nowrap">{deliveryNumber(d.number)}</td>
                      <td className="whitespace-nowrap text-sm">{formatDateTime(d.deliveredAt)}</td>
                      <td>
                        <Link href={`/requests/all/${t.id}#delivery`} className="link" dir="ltr">{txNumber(t.number)}</Link> {t.title}
                        <div className="text-xs text-neutral-500">{t.company.name}</div>
                      </td>
                      <td>{d.recipientName}</td>
                      <td><Badge className={CHANNEL_STYLES[d.channel]}>{CHANNEL_LABELS[d.channel]}</Badge></td>
                      <td>{count}</td>
                      <td className="text-sm">{d.deliveredBy.name}</td>
                      <td>
                        <div className="flex items-center gap-3 text-xs">
                          <Link href={`/requests/deliverables/${d.id}/receipt`} className="link flex items-center gap-1 whitespace-nowrap"><Printer size={14} /> الإيصال</Link>
                          {wa && <a href={wa} target="_blank" rel="noopener" title="إرسال على واتساب" className="text-emerald-700"><MessageCircle size={16} /></a>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
