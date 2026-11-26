import Link from "next/link";
import { Download, Eye, FileSpreadsheet, FileText, Image as ImageIcon } from "lucide-react";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import SearchBox from "@/components/ui/SearchBox";
import { ARCHIVE_INCLUDE, type ArchiveFilters, EXPIRY_SOON_DAYS, OWNER_LABELS, archiveWhere, ownerOf } from "@/lib/archive";
import { requireSection } from "@/lib/auth";
import { daysText } from "@/lib/clients";
import { db } from "@/lib/db";
import { DOC_TYPE_LABELS } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import { DAY_MS, currentMonthKey, monthBounds, riyadhToday } from "@/lib/time";

const LIMIT = 200;
const OWNER_STYLES = {
  client: "bg-sky-50 text-sky-700 ring-sky-200",
  company: "bg-violet-50 text-violet-700 ring-violet-200",
  contract: "bg-amber-50 text-amber-800 ring-amber-200",
  employee: "bg-teal-50 text-teal-700 ring-teal-200",
  transaction: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  letter: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  asset: "bg-rose-50 text-rose-700 ring-rose-200",
  purchase: "bg-indigo-50 text-indigo-700 ring-indigo-200",
} as const;

export default async function ArchivePage({ searchParams }: { searchParams: Promise<ArchiveFilters> }) {
  const user = await requireSection("admin-affairs");
  const f = await searchParams;
  const where = archiveWhere(user, f);
  const all = archiveWhere(user, {});
  const today = riyadhToday();
  const soonEnd = new Date(today.getTime() + EXPIRY_SOON_DAYS * DAY_MS);
  const { start, end } = monthBounds(currentMonthKey());

  const [docs, found, total, expired, soon, thisMonth] = await Promise.all([
    db.document.findMany({ where, include: ARCHIVE_INCLUDE, orderBy: { createdAt: "desc" }, take: LIMIT }),
    db.document.count({ where }),
    db.document.count({ where: all }),
    db.document.count({ where: { AND: [all, { expiresAt: { lt: today } }] } }),
    db.document.count({ where: { AND: [all, { expiresAt: { gte: today, lt: soonEnd } }] } }),
    db.document.count({ where: { AND: [all, { createdAt: { gte: start, lt: end } }] } }),
  ]);

  const kpis = [
    { label: "كل المستندات", value: total, href: "/admin-affairs/archive" },
    { label: "منتهية الصلاحية", value: expired, href: "/admin-affairs/archive?expiry=expired", alert: expired > 0 },
    { label: `تنتهي خلال ${daysText(EXPIRY_SOON_DAYS)}`, value: soon, href: "/admin-affairs/archive?expiry=soon" },
    { label: "رُفعت هذا الشهر", value: thisMonth },
  ];
  const exportHref = `/api/archive/export?${new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="الأرشيف والمستندات"
        crumbs={[{ label: "الشؤون الإدارية" }, { label: "الأرشيف والمستندات" }]}
        actions={<a href={exportHref} className="btn-secondary"><FileSpreadsheet size={16} /> تصدير Excel</a>}
      />
      <p className="text-sm text-navy-100">
        كل المستندات المرفوعة في المنصة في مكان واحد: مستندات العملاء والشركات والعقود والموظفين، ومخرجات المعاملات، ومرفقات الخطابات والأصول.
        يظهر لك فقط ما تسمح صلاحياتك بفتحه.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const body = (
            <>
              <div className="text-sm text-navy-100">{k.label}</div>
              <div className={`stat-value ${k.alert ? "text-rose-300" : "text-white"}`}>{k.value}</div>
            </>
          );
          return k.href
            ? <Link key={k.label} href={k.href} className="card-dark p-4 hover:ring-2 hover:ring-gold-500/40">{body}</Link>
            : <div key={k.label} className="card-dark p-4">{body}</div>;
        })}
      </div>

      <SearchBox placeholder="اسم المستند أو الملف، العميل، الشركة، السجل، الموظف، المعاملة، الخطاب" defaultValue={f.q}>
        <select name="owner" defaultValue={f.owner ?? ""} className="input w-auto">
          <option value="">كل الأقسام</option>
          {Object.entries(OWNER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="type" defaultValue={f.type ?? ""} className="input w-auto">
          <option value="">كل الأنواع</option>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="expiry" defaultValue={f.expiry ?? ""} className="input w-auto">
          <option value="">أي صلاحية</option>
          <option value="expired">منتهية</option>
          <option value="soon">تنتهي خلال {EXPIRY_SOON_DAYS} يوماً</option>
          <option value="valid">سارية</option>
          <option value="none">بدون تاريخ انتهاء</option>
        </select>
      </SearchBox>

      <p className="text-sm text-neutral-500">
        {found} مستند{found > LIMIT && ` — يُعرض أحدث ${LIMIT}، استخدم البحث أو التصدير للاطلاع على الكل`}
      </p>
      <div className="card overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr><th>المستند</th><th>يتبع</th><th>الملف</th><th>تاريخ الانتهاء</th><th>رفعه</th><th></th></tr>
          </thead>
          <tbody>
            {docs.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-neutral-500">لا توجد مستندات مطابقة</td></tr>}
            {docs.map((d) => {
              const o = ownerOf(d);
              const left = d.expiresAt ? Math.floor((d.expiresAt.getTime() - today.getTime()) / DAY_MS) : null;
              const Icon = d.mimeType === "application/pdf" ? FileText : ImageIcon;
              return (
                <tr key={d.id} className="hover:bg-neutral-50">
                  <td>
                    <div className="font-medium">{DOC_TYPE_LABELS[d.type]}</div>
                    {d.title && <div className="text-xs text-neutral-500">{d.title}</div>}
                  </td>
                  <td>
                    <Badge className={OWNER_STYLES[o.kind]}>{OWNER_LABELS[o.kind]}</Badge>
                    <Link href={o.href} className="link mr-2">{o.name}</Link>
                    {o.sub && <div className="text-xs text-neutral-500">{o.sub}</div>}
                  </td>
                  <td>
                    <span className="flex items-center gap-1.5 text-sm"><Icon size={15} className="shrink-0 text-brand-700" /><span className="max-w-44 truncate" dir="auto" title={d.fileName}>{d.fileName}</span></span>
                  </td>
                  <td className={`whitespace-nowrap ${left !== null && left < 0 ? "font-semibold text-rose-600" : left !== null && left <= EXPIRY_SOON_DAYS ? "font-semibold text-amber-700" : ""}`}>
                    {formatDate(d.expiresAt)}
                    {left !== null && left < 0 && <div className="text-xs">منتهٍ منذ {daysText(-left)}</div>}
                    {left !== null && left >= 0 && left <= EXPIRY_SOON_DAYS && <div className="text-xs">{left === 0 ? "ينتهي اليوم" : `متبقٍ ${daysText(left)}`}</div>}
                  </td>
                  <td className="text-xs text-neutral-600">{d.uploadedBy.name}<br />{formatDate(d.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-3 text-xs">
                      <a href={`/api/files/${d.id}`} target="_blank" rel="noopener" className="flex items-center gap-1 text-brand-700 hover:underline"><Eye size={14} /> عرض</a>
                      <a href={`/api/files/${d.id}?download`} className="flex items-center gap-1 text-neutral-600 hover:underline"><Download size={14} /> تحميل</a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
