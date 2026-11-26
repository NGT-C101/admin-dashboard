import Link from "next/link";
import type { Prisma, PurchaseStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import SearchBox from "@/components/ui/SearchBox";
import Tabs from "@/components/ui/Tabs";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatSAR } from "@/lib/format";
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_STYLES, SECTION, estimateTotal, purchaseNumber, purchaseQueueWhere } from "@/lib/purchases";
import { currentMonthKey, monthBounds } from "@/lib/time";
import { saveSupplier } from "./actions";
import SupplierFields from "./supplier-fields";

type SP = { tab?: string; q?: string; status?: string };

export default async function ProcurementPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection(SECTION);
  const sp = await searchParams;
  const tab = sp.tab === "suppliers" || sp.tab === "queue" ? sp.tab : "requests";
  const q = sp.q?.trim();
  const n = q ? Number(q.replace(/\D/g, "")) : 0;
  const { start, end } = monthBounds(currentMonthKey());

  const reqWhere: Prisma.PurchaseRequestWhereInput = tab === "queue" ? purchaseQueueWhere(user) : {
    ...(sp.status && sp.status in PURCHASE_STATUS_LABELS ? { status: sp.status as PurchaseStatus } : sp.status === "open" || !sp.status ? { status: { in: ["PENDING_MANAGER", "PENDING_APPROVAL", "APPROVED"] } } : {}),
    ...(q && { OR: [
      { title: { contains: q, mode: "insensitive" } },
      { requestedBy: { name: { contains: q, mode: "insensitive" } } },
      { supplier: { name: { contains: q, mode: "insensitive" } } },
      { items: { some: { description: { contains: q, mode: "insensitive" } } } },
      ...(n ? [{ number: n }] : []),
    ] }),
  };
  const [requests, suppliers, queue, approved, spent] = await Promise.all([
    tab !== "suppliers" ? db.purchaseRequest.findMany({
      where: reqWhere,
      include: { requestedBy: { select: { name: true } }, supplier: { select: { name: true } }, items: { select: { quantity: true, estUnitPrice: true } } },
      orderBy: { number: "desc" }, take: 300,
    }) : [],
    tab === "suppliers" ? db.supplier.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }] } : {},
      include: { _count: { select: { purchases: true } }, purchases: { where: { status: "RECEIVED" }, select: { totalActual: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }) : [],
    db.purchaseRequest.count({ where: purchaseQueueWhere(user) }),
    db.purchaseRequest.count({ where: { status: "APPROVED" } }),
    db.purchaseRequest.aggregate({ where: { status: "RECEIVED", receivedAt: { gte: start, lt: end } }, _sum: { totalActual: true }, _count: { _all: true } }),
  ]);

  const kpis = [
    { label: "بانتظار إجرائي", value: queue, note: queue ? "موافقة أو اعتماد أو شراء" : "لا توجد", href: "/admin-affairs/procurement?tab=queue" },
    { label: "معتمدة بانتظار الشراء", value: approved, note: approved ? "جاهزة للتنفيذ" : "لا توجد", href: "/admin-affairs/procurement?status=APPROVED" },
    { label: "مشتريات هذا الشهر", value: spent._count._all, note: formatSAR(spent._sum.totalActual ?? 0), href: "/admin-affairs/procurement?status=RECEIVED" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="المشتريات والموردين"
        crumbs={[{ label: "الشؤون الإدارية" }, { label: "المشتريات والموردين" }]}
        actions={<Link href="/admin-affairs/procurement/new" className="btn-primary"><Plus size={16} aria-hidden="true" /> طلب شراء</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="card-dark p-4 hover:ring-2 hover:ring-gold-500/40 focus-visible:ring-2 focus-visible:ring-gold-400">
            <div className="text-sm text-navy-100">{k.label}</div>
            <div className="stat-value text-white">{k.value}</div>
            <div className="text-xs font-semibold text-gold-300 tabular-nums">{k.note}</div>
          </Link>
        ))}
      </div>

      <Tabs base="/admin-affairs/procurement" current={tab} tabs={[
        { key: "requests", label: "طلبات الشراء" },
        { key: "queue", label: "بانتظار إجرائي", count: queue },
        { key: "suppliers", label: "الموردون" },
      ]} />

      {tab !== "queue" && (
        <SearchBox placeholder={tab === "suppliers" ? "اسم المورد، نوع التوريد، المسؤول…" : "رقم الطلب، العنوان، الصنف، مقدّم الطلب، المورد…"} defaultValue={q}>
          {tab === "suppliers" ? <input type="hidden" name="tab" value="suppliers" /> : (
            <select name="status" defaultValue={sp.status ?? "open"} aria-label="الحالة" className="input w-auto">
              <option value="open">الجارية</option>
              {Object.entries(PURCHASE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              <option value="all">الكل</option>
            </select>
          )}
        </SearchBox>
      )}

      {tab === "suppliers" ? (
        <div className="space-y-4">
          <div className="card overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead><tr><th>المورد</th><th>نوع التوريد</th><th>التواصل</th><th>الطلبات</th><th>إجمالي المشتريات</th></tr></thead>
              <tbody>
                {suppliers.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-neutral-500">لا يوجد موردون. أضف أول مورد من الأسفل.</td></tr>}
                {suppliers.map((s) => (
                  <tr key={s.id} className={`hover:bg-neutral-50 ${s.active ? "" : "opacity-60"}`}>
                    <td><Link href={`/admin-affairs/procurement/suppliers/${s.id}`} className="link">{s.name}</Link>{!s.active && <span className="text-xs text-neutral-500"> (موقوف)</span>}</td>
                    <td>{s.category ?? "—"}</td>
                    <td className="text-sm">{s.contactName ?? "—"}{s.phone && <div dir="ltr" className="text-right text-xs text-neutral-500">{s.phone}</div>}</td>
                    <td className="tabular-nums">{s._count.purchases}</td>
                    <td className="tabular-nums">{formatSAR(s.purchases.reduce((t, x) => t + Number(x.totalActual ?? 0), 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {can(user, SECTION, "EDIT") && (
            <Collapsible label="إضافة مورد">
              <ActionForm action={saveSupplier} submitLabel="إضافة المورد"><SupplierFields /></ActionForm>
            </Collapsible>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[860px]">
            <thead><tr><th>الرقم</th><th>العنوان</th><th>مقدّم الطلب</th><th>التاريخ</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
            <tbody>
              {requests.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-neutral-500">لا توجد طلبات</td></tr>}
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td dir="ltr" className="whitespace-nowrap text-right font-semibold tabular-nums"><Link href={`/admin-affairs/procurement/${r.id}`} className="link">{purchaseNumber(r.number)}</Link></td>
                  <td className="max-w-72"><Link href={`/admin-affairs/procurement/${r.id}`} className="break-words hover:underline">{r.title}</Link>{r.supplier && <div className="text-xs text-neutral-500">{r.supplier.name}</div>}</td>
                  <td>{r.requestedBy.name}</td>
                  <td className="whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="whitespace-nowrap tabular-nums">
                    {r.totalActual ? formatSAR(r.totalActual) : formatSAR(estimateTotal(r.items))}
                    <div className="text-xs text-neutral-500">{r.totalActual ? "فعلي" : "تقديري"}</div>
                  </td>
                  <td><Badge className={PURCHASE_STATUS_STYLES[r.status]}>{PURCHASE_STATUS_LABELS[r.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
