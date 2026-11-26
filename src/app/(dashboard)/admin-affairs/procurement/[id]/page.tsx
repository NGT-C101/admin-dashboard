import Link from "next/link";
import { notFound } from "next/navigation";
import DocumentsSection from "@/components/DocumentsSection";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import DateField from "@/components/ui/DateField";
import { Field } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { assetNumber } from "@/lib/assets";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatSAR } from "@/lib/format";
import {
  PURCHASE_STATUS_LABELS, PURCHASE_STATUS_STYLES, SECTION, canApprovePurchase, canManagerDecide, canViewPurchase, estimateTotal, purchaseNumber,
} from "@/lib/purchases";
import { dateKey, riyadhToday } from "@/lib/time";
import { addQuote, approvalDecision, cancelPurchase, managerDecision, receivePurchase } from "../actions";

function Decision({ action, id, okLabel }: { action: typeof managerDecision; id: string; okLabel: string }) {
  return (
    <ActionForm action={action} submitLabel="حفظ القرار" className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <select name="decision" defaultValue="OK" aria-label="القرار" className="input">
        <option value="OK">{okLabel}</option>
        <option value="REJECT">رفض</option>
      </select>
      <textarea name="note" rows={2} placeholder="ملاحظة (مطلوبة عند الرفض)…" aria-label="ملاحظة" className="input" />
    </ActionForm>
  );
}

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = await db.purchaseRequest.findUnique({
    where: { id },
    include: {
      items: { orderBy: { order: "asc" }, include: { category: { select: { name: true } } } },
      quotes: { orderBy: { amount: "asc" }, include: { supplier: { select: { id: true, name: true } } } },
      requestedBy: { select: { name: true } }, managerBy: { select: { name: true } }, approvedBy: { select: { name: true } }, receivedBy: { select: { name: true } },
      supplier: { select: { id: true, name: true } },
      documents: { orderBy: { createdAt: "asc" }, include: { uploadedBy: { select: { name: true } } } },
      assets: { select: { id: true, number: true, name: true }, orderBy: { number: "asc" } },
      events: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!p || !(await canViewPurchase(db, user, p))) notFound();

  const edit = can(user, SECTION, "EDIT");
  const manage = can(user, SECTION, "MANAGE");
  const [mgr, suppliers] = await Promise.all([
    canManagerDecide(db, user, p),
    edit && ["PENDING_APPROVAL", "APPROVED"].includes(p.status) ? db.supplier.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  const est = estimateTotal(p.items);
  const mayCancel = (p.requestedById === user.id && ["PENDING_MANAGER", "PENDING_APPROVAL"].includes(p.status)) || (manage && !["RECEIVED", "REJECTED", "CANCELLED"].includes(p.status));
  const cheapest = p.quotes[0]?.supplier.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.title}
        crumbs={[can(user, SECTION) ? { label: "المشتريات والموردين", href: "/admin-affairs/procurement" } : { label: "خدماتي", href: "/me" }, { label: purchaseNumber(p.number) }]}
        actions={<Badge className={PURCHASE_STATUS_STYLES[p.status]}>{PURCHASE_STATUS_LABELS[p.status]}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-6 lg:col-span-2">
          <div className="card space-y-4 p-5">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {([
                ["مقدّم الطلب", `${p.requestedBy.name} — ${formatDate(p.createdAt)}`],
                ["مطلوب قبل", formatDate(p.neededBy)],
                ["الإجمالي التقديري", <span key="e" className="tabular-nums">{formatSAR(est)}</span>],
                ["موافقة المدير المباشر", p.managerBy ? `${p.managerBy.name} — ${formatDate(p.managerAt)}` : "—"],
                ["اعتماد الشؤون الإدارية", p.approvedBy ? `${p.approvedBy.name} — ${formatDate(p.approvedAt)}` : "—"],
                ["المورد", p.supplier ? <Link key="s" href={`/admin-affairs/procurement/suppliers/${p.supplier.id}`} className="link">{p.supplier.name}</Link> : "—"],
                ...(p.status === "RECEIVED" ? [
                  ["الإجمالي الفعلي", <span key="t" className="tabular-nums">{formatSAR(p.totalActual)}</span>],
                  ["رقم الفاتورة", p.invoiceNumber],
                  ["الاستلام", `${p.receivedBy?.name ?? "—"} — ${formatDate(p.receivedAt)}`],
                ] : []),
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k}><dt className="text-xs text-neutral-500">{k}</dt><dd className="break-words font-medium">{v || "—"}</dd></div>
              ))}
            </dl>
            <p className="whitespace-pre-line border-t border-neutral-100 pt-4 text-sm"><span className="text-neutral-500">سبب الحاجة: </span>{p.justification}</p>
            {p.rejectReason && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">سبب الرفض: {p.rejectReason}</p>}
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">البنود</h2>
            <div className="card overflow-x-auto">
              <table className="table min-w-[620px]">
                <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>سعر الوحدة التقديري</th><th>الإجمالي</th></tr></thead>
                <tbody>
                  {p.items.map((it, i) => (
                    <tr key={it.id}>
                      <td className="tabular-nums">{i + 1}</td>
                      <td>{it.description}{it.isAsset && <div className="text-xs text-sky-700">أصل — {it.category?.name}</div>}</td>
                      <td className="tabular-nums">{it.quantity}</td>
                      <td className="tabular-nums">{formatSAR(it.estUnitPrice)}</td>
                      <td className="tabular-nums font-semibold">{it.estUnitPrice ? formatSAR(estimateTotal([it])) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {(p.quotes.length > 0 || suppliers.length > 0) && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">عروض الموردين <span className="text-sm font-normal text-neutral-500">(اختيارية للمقارنة)</span></h2>
              <div className="card overflow-x-auto">
                <table className="table min-w-[520px]">
                  <thead><tr><th>المورد</th><th>الإجمالي شامل الضريبة</th><th>ملاحظات</th><th></th></tr></thead>
                  <tbody>
                    {p.quotes.length === 0 && <tr><td colSpan={4} className="py-5 text-center text-neutral-500">لا توجد عروض. يمكنك الشراء دون عروض، أو إضافة عروض للمقارنة وإرفاق ملفاتها في المرفقات.</td></tr>}
                    {p.quotes.map((q) => (
                      <tr key={q.id}>
                        <td><Link href={`/admin-affairs/procurement/suppliers/${q.supplier.id}`} className="link">{q.supplier.name}</Link></td>
                        <td className="tabular-nums font-semibold">{formatSAR(q.amount)}</td>
                        <td className="text-sm">{q.notes ?? "—"}</td>
                        <td>
                          {q.selected && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">تم الشراء منه</Badge>}
                          {!q.selected && q.supplier.id === cheapest && p.quotes.length > 1 && <Badge className="bg-sky-50 text-sky-700 ring-sky-200">الأقل سعراً</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {suppliers.length > 0 && (
                <details className="card">
                  <summary className="cursor-pointer select-none p-4 font-semibold">+ إضافة عرض سعر</summary>
                  <div className="border-t border-neutral-100 p-4">
                    <ActionForm action={addQuote} submitLabel="إضافة العرض" className="grid gap-3 sm:grid-cols-3">
                      <input type="hidden" name="id" value={p.id} />
                      <select name="supplierId" required defaultValue="" aria-label="المورد" className="input">
                        <option value="" disabled>المورد</option>
                        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <input name="amount" required inputMode="decimal" dir="ltr" placeholder="الإجمالي شامل الضريبة…" aria-label="المبلغ" autoComplete="off" className="input tabular-nums" />
                      <input name="notes" placeholder="ملاحظات (مدة التوريد، الضمان…)" aria-label="ملاحظات" className="input" />
                    </ActionForm>
                  </div>
                </details>
              )}
            </section>
          )}

          {p.assets.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">الأصول المضافة من هذا الطلب</h2>
              <div className="card flex flex-wrap gap-2 p-4">
                {p.assets.map((a) => <Link key={a.id} href={`/admin-affairs/assets/${a.id}`} className="link rounded-lg bg-neutral-50 px-2 py-1 text-sm"><span dir="ltr">{assetNumber(a.number)}</span> {a.name}</Link>)}
              </div>
            </section>
          )}

          <DocumentsSection ownerType="purchase" ownerId={p.id} title="المرفقات (عروض الموردين، الفاتورة)" documents={p.documents} userId={user.id} canUpload={edit && p.status !== "CANCELLED"} canManage={manage} />
        </div>

        <div className="space-y-6">
          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">الإجراءات</h2>
            {p.status === "PENDING_MANAGER" && (mgr
              ? <><p className="text-sm font-medium">موافقة المدير المباشر</p><Decision action={managerDecision} id={p.id} okLabel="موافقة وإحالة للشؤون الإدارية" /></>
              : <p className="text-sm text-amber-700">بانتظار موافقة المدير المباشر لمقدّم الطلب.</p>)}
            {p.status === "PENDING_APPROVAL" && (canApprovePurchase(user, p)
              ? <><p className="text-sm font-medium">اعتماد الشؤون الإدارية</p><Decision action={approvalDecision} id={p.id} okLabel="اعتماد للشراء" /></>
              : <p className="text-sm text-sky-700">بانتظار اعتماد المسؤول عن الشؤون الإدارية.</p>)}
            {p.status === "APPROVED" && (edit ? (
              <ActionForm action={receivePurchase} submitLabel="تسجيل الشراء والاستلام" confirm="تأكيد تسجيل الشراء والاستلام؟ ستُضاف البنود المعلَّمة كأصول إلى سجل الأصول.">
                <input type="hidden" name="id" value={p.id} />
                <Field label="المورد *">
                  <select name="supplierId" required defaultValue={cheapest ?? ""} className="input">
                    <option value="" disabled>اختر المورد</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="الإجمالي الفعلي شامل الضريبة (ريال) *"><input name="totalActual" required inputMode="decimal" dir="ltr" autoComplete="off" className="input tabular-nums" /></Field>
                <Field label="رقم الفاتورة"><input name="invoiceNumber" dir="ltr" autoComplete="off" className="input" /></Field>
                <Field label="تاريخ الاستلام"><DateField name="receivedAt" defaultValue={dateKey(riyadhToday())} /></Field>
                {p.items.filter((i) => i.isAsset).map((it) => (
                  <Field key={it.id} label={`سعر الوحدة الفعلي: ${it.description} (${it.quantity})`}>
                    <input name={`actual_${it.id}`} inputMode="decimal" dir="ltr" defaultValue={it.estUnitPrice?.toString() ?? ""} autoComplete="off" className="input tabular-nums" />
                  </Field>
                ))}
                {suppliers.length === 0 && <p className="text-xs text-amber-700">لا يوجد موردون. أضف المورد من تبويب «الموردون» أولاً.</p>}
                {p.items.some((i) => i.isAsset) && <p className="text-xs text-neutral-500">ستُضاف {p.items.filter((i) => i.isAsset).reduce((s, i) => s + i.quantity, 0)} وحدة إلى سجل الأصول تلقائياً.</p>}
              </ActionForm>
            ) : <p className="text-sm text-violet-700">معتمد، وبانتظار الشراء من الشؤون الإدارية.</p>)}
            {p.status === "RECEIVED" && <p className="text-sm text-emerald-700">اكتمل الطلب: تم الشراء والاستلام{p.assets.length > 0 && ` وأُضيف ${p.assets.length} أصل لسجل الأصول`}.</p>}
            {(p.status === "REJECTED" || p.status === "CANCELLED") && <p className="text-sm text-neutral-600">الطلب {p.status === "REJECTED" ? "مرفوض" : "ملغى"} ولا يتطلب إجراءً.</p>}
            {mayCancel && (
              <details className="border-t border-neutral-100 pt-3">
                <summary className="cursor-pointer select-none text-sm text-rose-700">إلغاء الطلب</summary>
                <ActionForm action={cancelPurchase} submitLabel="تأكيد الإلغاء" className="mt-2 space-y-2" confirm="تأكيد إلغاء طلب الشراء؟">
                  <input type="hidden" name="id" value={p.id} />
                  <input name="reason" placeholder="السبب (اختياري)…" aria-label="سبب الإلغاء" className="input" />
                </ActionForm>
              </details>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-4 font-semibold">سجل الطلب</h2>
            <ol className="relative space-y-5 border-r-2 border-neutral-200 pr-4">
              {p.events.map((e) => (
                <li key={e.id} className="relative">
                  <span aria-hidden="true" className="absolute -right-[23px] top-1.5 h-3 w-3 rounded-full bg-brand-600 ring-4 ring-white" />
                  <p className="whitespace-pre-line text-sm">{e.note}</p>
                  <p className="mt-1 text-xs text-neutral-500">{e.user.name} · {formatDateTime(e.createdAt)}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
