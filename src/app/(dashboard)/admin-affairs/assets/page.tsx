import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import SearchBox from "@/components/ui/SearchBox";
import Tabs from "@/components/ui/Tabs";
import {
  ASSET_STATUS_LABELS, ASSET_STATUS_STYLES, CUSTODY_STATUS_LABELS, CUSTODY_STATUS_STYLES, OPEN_CUSTODY, SECTION, WARRANTY_SOON_DAYS, assetNumber,
} from "@/lib/assets";
import { can, requireSection } from "@/lib/auth";
import { daysText } from "@/lib/clients";
import { db } from "@/lib/db";
import { formatDate, formatSAR } from "@/lib/format";
import { DAY_MS, riyadhToday } from "@/lib/time";
import { saveCategory } from "./actions";

type SP = { tab?: string; q?: string; status?: string; category?: string };

export default async function AssetsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection(SECTION);
  const sp = await searchParams;
  const manage = can(user, SECTION, "MANAGE");
  const tab = sp.tab === "custody" ? "custody" : sp.tab === "categories" && manage ? "categories" : "assets";
  const q = sp.q?.trim();
  const today = riyadhToday();
  const soonEnd = new Date(today.getTime() + WARRANTY_SOON_DAYS * DAY_MS);

  const assetWhere: Prisma.AssetWhereInput = {
    ...(q && { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { serialNumber: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
      { custodies: { some: { ...OPEN_CUSTODY, employee: { fullName: { contains: q, mode: "insensitive" } } } } },
      ...(Number(q.replace(/\D/g, "")) ? [{ number: Number(q.replace(/\D/g, "")) }] : []),
    ] }),
    ...(sp.status === "warranty" ? { warrantyEnd: { gte: today, lt: soonEnd }, status: { notIn: ["RETIRED", "LOST"] } }
      : sp.status && sp.status in ASSET_STATUS_LABELS ? { status: sp.status as keyof typeof ASSET_STATUS_LABELS }
      : { status: { notIn: ["RETIRED", "LOST"] } }),
    ...(sp.category && { categoryId: sp.category }),
  };
  const custodyWhere: Prisma.CustodyWhereInput = {
    ...(sp.status === "RETURNED" ? { status: "RETURNED" } : sp.status === "PENDING" ? { status: "PENDING" } : OPEN_CUSTODY),
    ...(q && { OR: [
      { employee: { fullName: { contains: q, mode: "insensitive" } } },
      { asset: { name: { contains: q, mode: "insensitive" } } },
      { asset: { serialNumber: { contains: q, mode: "insensitive" } } },
    ] }),
  };

  const [assets, custodies, categories, counts, pending, warranty, value] = await Promise.all([
    tab === "assets" ? db.asset.findMany({
      where: assetWhere,
      include: { category: { select: { name: true } }, custodies: { where: OPEN_CUSTODY, include: { employee: { select: { id: true, fullName: true } } } } },
      orderBy: { number: "desc" }, take: 500,
    }) : [],
    tab === "custody" ? db.custody.findMany({
      where: custodyWhere,
      include: { asset: { select: { id: true, number: true, name: true, serialNumber: true } }, employee: { select: { id: true, fullName: true, status: true } } },
      orderBy: { assignedAt: "desc" }, take: 500,
    }) : [],
    db.assetCategory.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], include: { _count: { select: { assets: true } } } }),
    db.asset.groupBy({ by: ["status"], _count: { _all: true } }),
    db.custody.count({ where: { status: "PENDING" } }),
    db.asset.count({ where: { warrantyEnd: { gte: today, lt: soonEnd }, status: { notIn: ["RETIRED", "LOST"] } } }),
    db.asset.aggregate({ where: { status: { notIn: ["RETIRED", "LOST"] } }, _sum: { purchasePrice: true } }),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const kpis = [
    { label: "الأصول القائمة", value: n("AVAILABLE") + n("IN_CUSTODY") + n("MAINTENANCE"), note: `قيمة الشراء ${formatSAR(value._sum.purchasePrice ?? 0)}`, href: "/admin-affairs/assets" },
    { label: "في عهدة الموظفين", value: n("IN_CUSTODY"), note: `${n("AVAILABLE")} متاح · ${n("MAINTENANCE")} في الصيانة`, href: "/admin-affairs/assets?tab=custody" },
    { label: "بانتظار إقرار الموظف", value: pending, note: pending ? "لم يؤكدوا الاستلام بعد" : "لا توجد", href: "/admin-affairs/assets?tab=custody&status=PENDING" },
    { label: `ضمان ينتهي خلال ${daysText(WARRANTY_SOON_DAYS)}`, value: warranty, note: warranty ? "راجع الصيانة أو التجديد" : "لا توجد", href: "/admin-affairs/assets?status=warranty" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="الأصول والعُهد"
        crumbs={[{ label: "الشؤون الإدارية" }, { label: "الأصول والعُهد" }]}
        actions={can(user, SECTION, "EDIT") && <Link href="/admin-affairs/assets/new" className="btn-primary"><Plus size={16} aria-hidden="true" /> أصل جديد</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="card-dark p-4 hover:ring-2 hover:ring-gold-500/40 focus-visible:ring-2 focus-visible:ring-gold-400">
            <div className="text-sm text-navy-100">{k.label}</div>
            <div className="stat-value text-white">{k.value}</div>
            <div className="text-xs font-semibold text-gold-300">{k.note}</div>
          </Link>
        ))}
      </div>

      <Tabs base="/admin-affairs/assets" current={tab} tabs={[
        { key: "assets", label: "الأصول" },
        { key: "custody", label: "العُهد", count: n("IN_CUSTODY") },
        ...(manage ? [{ key: "categories", label: "التصنيفات" }] : []),
      ]} />

      {tab === "categories" ? (
        <div className="card space-y-3 p-5">
          <p className="text-sm text-neutral-500">الرقم الصغير هو الترتيب. التصنيف الموقوف لا يظهر عند إضافة أصل جديد.</p>
          {categories.map((c) => (
            <ActionForm key={c.id} action={saveCategory} submitLabel="حفظ" resetOnSuccess={false} className={`flex flex-wrap items-center gap-2 ${c.active ? "" : "opacity-60"}`}>
              <input type="hidden" name="id" value={c.id} />
              <input name="order" type="number" min={0} defaultValue={c.order} aria-label="الترتيب" className="input w-20" />
              <input name="name" required defaultValue={c.name} aria-label="اسم التصنيف" className="input min-w-48 flex-1" />
              <select name="active" defaultValue={c.active ? "on" : "off"} aria-label="الحالة" className="input w-auto">
                <option value="on">مفعّل</option><option value="off">موقوف</option>
              </select>
              <span className="text-xs text-neutral-500">{c._count.assets} أصل</span>
            </ActionForm>
          ))}
          <div className="border-t border-neutral-100 pt-3">
            <ActionForm action={saveCategory} submitLabel="إضافة" className="flex flex-wrap items-center gap-2">
              <input name="order" type="number" min={0} defaultValue={categories.length} aria-label="الترتيب" className="input w-20" />
              <input name="name" required placeholder="تصنيف جديد، مثل: كاميرات…" aria-label="اسم التصنيف" className="input min-w-48 flex-1" />
            </ActionForm>
          </div>
        </div>
      ) : (
        <>
          <SearchBox placeholder={tab === "custody" ? "اسم الموظف، الأصل، الرقم التسلسلي…" : "اسم الأصل، الماركة، الرقم التسلسلي، الموقع، الموظف…"} defaultValue={q}>
            {tab === "custody" && <input type="hidden" name="tab" value="custody" />}
            <select name="status" defaultValue={sp.status ?? ""} aria-label="الحالة" className="input w-auto">
              {tab === "custody" ? (
                <>
                  <option value="">العُهد القائمة</option>
                  <option value="PENDING">بانتظار إقرار الموظف</option>
                  <option value="RETURNED">المُعادة</option>
                </>
              ) : (
                <>
                  <option value="">القائمة (بدون المستبعد والمفقود)</option>
                  {Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  <option value="warranty">ضمان ينتهي قريباً</option>
                </>
              )}
            </select>
            {tab === "assets" && (
              <select name="category" defaultValue={sp.category ?? ""} aria-label="التصنيف" className="input w-auto">
                <option value="">كل التصنيفات</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </SearchBox>

          {tab === "assets" ? (
            <div className="card overflow-x-auto">
              <table className="table min-w-[900px]">
                <thead><tr><th>الرقم</th><th>الأصل</th><th>التصنيف</th><th>لدى</th><th>الضمان</th><th>سعر الشراء</th><th>الحالة</th></tr></thead>
                <tbody>
                  {assets.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-neutral-500">لا توجد أصول. أضف أول أصل من زر «أصل جديد».</td></tr>}
                  {assets.map((a) => {
                    const holder = a.custodies[0];
                    const left = a.warrantyEnd ? Math.floor((a.warrantyEnd.getTime() - today.getTime()) / DAY_MS) : null;
                    return (
                      <tr key={a.id} className="hover:bg-neutral-50">
                        <td dir="ltr" className="whitespace-nowrap text-right font-semibold tabular-nums"><Link href={`/admin-affairs/assets/${a.id}`} className="link">{assetNumber(a.number)}</Link></td>
                        <td className="max-w-64">
                          <Link href={`/admin-affairs/assets/${a.id}`} className="break-words hover:underline">{a.name}</Link>
                          {(a.brand || a.serialNumber) && <div className="text-xs text-neutral-500" dir="auto">{[a.brand, a.serialNumber].filter(Boolean).join(" · ")}</div>}
                        </td>
                        <td>{a.category.name}</td>
                        <td>{holder ? <Link href={`/employees/profiles/${holder.employee.id}`} className="link">{holder.employee.fullName}</Link> : (a.location ?? "—")}</td>
                        <td className={`whitespace-nowrap ${left !== null && left < 0 ? "text-neutral-400" : left !== null && left < WARRANTY_SOON_DAYS ? "font-semibold text-amber-700" : ""}`}>
                          {formatDate(a.warrantyEnd)}
                          {left !== null && left >= 0 && left < WARRANTY_SOON_DAYS && <div className="text-xs">متبقٍ {daysText(left)}</div>}
                          {left !== null && left < 0 && <div className="text-xs">انتهى</div>}
                        </td>
                        <td className="whitespace-nowrap tabular-nums">{formatSAR(a.purchasePrice)}</td>
                        <td><Badge className={ASSET_STATUS_STYLES[a.status]}>{ASSET_STATUS_LABELS[a.status]}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="table min-w-[860px]">
                <thead><tr><th>الموظف</th><th>الأصل</th><th>تاريخ التسليم</th><th>الإقرار</th><th>الإعادة</th><th>الحالة</th></tr></thead>
                <tbody>
                  {custodies.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-neutral-500">لا توجد عُهد</td></tr>}
                  {custodies.map((c) => (
                    <tr key={c.id} className="hover:bg-neutral-50">
                      <td>
                        <Link href={`/employees/profiles/${c.employee.id}`} className="link">{c.employee.fullName}</Link>
                        {c.employee.status === "TERMINATED" && c.status !== "RETURNED" && <div className="text-xs font-semibold text-rose-600">منتهية خدمته</div>}
                      </td>
                      <td><Link href={`/admin-affairs/assets/${c.asset.id}`} className="hover:underline">{c.asset.name}</Link><div className="text-xs text-neutral-500 tabular-nums" dir="ltr">{assetNumber(c.asset.number)}</div></td>
                      <td className="whitespace-nowrap">{formatDate(c.assignedAt)}</td>
                      <td className="text-sm">{c.acknowledgedAt ? <>{formatDate(c.acknowledgedAt)}<div className="text-xs text-neutral-500">{c.ackMethod === "PAPER" ? "نموذج ورقي" : "عبر المنصة"}</div></> : "—"}</td>
                      <td className="whitespace-nowrap">{formatDate(c.returnedAt)}</td>
                      <td><Badge className={CUSTODY_STATUS_STYLES[c.status]}>{CUSTODY_STATUS_LABELS[c.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
