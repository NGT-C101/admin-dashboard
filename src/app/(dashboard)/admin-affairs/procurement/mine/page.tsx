import Link from "next/link";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatSAR } from "@/lib/format";
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_STYLES, estimateTotal, purchaseNumber, purchaseQueueWhere } from "@/lib/purchases";

// طلبات الشراء التي تنتظر موافقتي (للمدير المباشر الذي ليست لديه صلاحية الشؤون الإدارية)
export default async function MyPurchaseQueuePage() {
  const user = await requireUser();
  const rows = await db.purchaseRequest.findMany({
    where: purchaseQueueWhere(user),
    include: { requestedBy: { select: { name: true } }, items: { select: { quantity: true, estUnitPrice: true } } },
    orderBy: { number: "asc" },
  });
  return (
    <div className="space-y-6">
      <PageHeader title="طلبات شراء بانتظار إجرائي" crumbs={[{ label: "خدماتي", href: "/me" }, { label: "طلبات الشراء" }]} />
      <div className="card overflow-x-auto">
        <table className="table min-w-[640px]">
          <thead><tr><th>الرقم</th><th>العنوان</th><th>مقدّم الطلب</th><th>التاريخ</th><th>الإجمالي التقديري</th><th>الحالة</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-neutral-500">لا توجد طلبات بانتظارك</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50">
                <td dir="ltr" className="text-right tabular-nums"><Link href={`/admin-affairs/procurement/${r.id}`} className="link">{purchaseNumber(r.number)}</Link></td>
                <td>{r.title}</td><td>{r.requestedBy.name}</td><td>{formatDate(r.createdAt)}</td>
                <td className="tabular-nums">{formatSAR(estimateTotal(r.items))}</td>
                <td><Badge className={PURCHASE_STATUS_STYLES[r.status]}>{PURCHASE_STATUS_LABELS[r.status]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
