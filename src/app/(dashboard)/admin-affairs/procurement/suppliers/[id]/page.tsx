import Link from "next/link";
import { notFound } from "next/navigation";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatSAR } from "@/lib/format";
import { formatIban } from "@/lib/hr";
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_STYLES, SECTION, purchaseNumber } from "@/lib/purchases";
import { saveSupplier } from "../../actions";
import SupplierFields from "../../supplier-fields";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSection(SECTION);
  const { id } = await params;
  const s = await db.supplier.findUnique({
    where: { id },
    include: {
      purchases: { orderBy: { number: "desc" }, select: { id: true, number: true, title: true, status: true, totalActual: true, receivedAt: true } },
      quotes: { orderBy: { createdAt: "desc" }, include: { purchase: { select: { id: true, number: true, title: true } } } },
    },
  });
  if (!s) notFound();
  const total = s.purchases.filter((p) => p.status === "RECEIVED").reduce((t, p) => t + Number(p.totalActual ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={s.name} crumbs={[{ label: "الموردون", href: "/admin-affairs/procurement?tab=suppliers" }, { label: s.name }]}
        actions={!s.active && <Badge className="bg-neutral-100 text-neutral-600 ring-neutral-200">موقوف</Badge>} />
      <div className="card p-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ["نوع التوريد", s.category], ["المسؤول", s.contactName], ["الجوال", s.phone && <span key="p" dir="ltr">{s.phone}</span>],
            ["البريد", s.email && <span key="e" dir="ltr">{s.email}</span>], ["المدينة", s.city], ["السجل / الرقم الموحد", s.crNumber && <span key="c" dir="ltr">{s.crNumber}</span>],
            ["الرقم الضريبي", s.vatNumber && <span key="v" dir="ltr">{s.vatNumber}</span>], ["الآيبان", s.iban && <span key="i" dir="ltr" className="font-mono text-sm">{formatIban(s.iban)}</span>],
            ["إجمالي المشتريات", <span key="t" className="tabular-nums">{formatSAR(total)}</span>],
          ] as [string, React.ReactNode][]).map(([k, v]) => (
            <div key={k}><dt className="text-xs text-neutral-500">{k}</dt><dd className="break-words font-medium">{v || "—"}</dd></div>
          ))}
        </dl>
        {s.notes && <p className="mt-4 whitespace-pre-line border-t border-neutral-100 pt-4 text-sm text-neutral-600">{s.notes}</p>}
      </div>
      {can(user, SECTION, "EDIT") && (
        <Collapsible label="تعديل بيانات المورد">
          <ActionForm action={saveSupplier} submitLabel="حفظ" resetOnSuccess={false}><SupplierFields s={s} /></ActionForm>
        </Collapsible>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">المشتريات من هذا المورد</h2>
        <div className="card overflow-x-auto">
          <table className="table min-w-[600px]">
            <thead><tr><th>الطلب</th><th>العنوان</th><th>الاستلام</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
            <tbody>
              {s.purchases.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-neutral-500">لا توجد مشتريات بعد</td></tr>}
              {s.purchases.map((p) => (
                <tr key={p.id}>
                  <td dir="ltr" className="text-right tabular-nums"><Link href={`/admin-affairs/procurement/${p.id}`} className="link">{purchaseNumber(p.number)}</Link></td>
                  <td>{p.title}</td><td>{formatDate(p.receivedAt)}</td><td className="tabular-nums">{formatSAR(p.totalActual)}</td>
                  <td><Badge className={PURCHASE_STATUS_STYLES[p.status]}>{PURCHASE_STATUS_LABELS[p.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {s.quotes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">عروض الأسعار المقدَّمة</h2>
          <div className="card divide-y divide-neutral-100">
            {s.quotes.map((q) => (
              <Link key={q.id} href={`/admin-affairs/procurement/${q.purchase.id}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-neutral-50">
                <span><span dir="ltr">{purchaseNumber(q.purchase.number)}</span> — {q.purchase.title}</span>
                <span className="tabular-nums font-semibold">{formatSAR(q.amount)}{q.selected && " (تم الشراء)"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
