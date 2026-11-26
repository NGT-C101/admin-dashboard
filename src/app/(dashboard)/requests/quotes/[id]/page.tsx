import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Printer } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import { Field } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateInputValue, formatDate, formatDateTime, formatSAR, txNumber } from "@/lib/format";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_STYLES, isEditable, quoteNumber, quoteView } from "@/lib/quotes";
import { changeQuoteStatus, convertQuoteToTransaction, deleteQuote, duplicateQuote, updateQuote } from "../../quote-actions";
import QuoteFields from "../QuoteFields";
import { loadQuoteOptions } from "../options";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSection("requests");
  const { id } = await params;
  const q = await db.quote.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, companies: { select: { id: true, name: true }, orderBy: { name: "asc" } } } },
      company: { select: { id: true, name: true } },
      items: { orderBy: { order: "asc" }, include: { serviceType: { select: { name: true } } } },
      transaction: { select: { id: true, number: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!q) notFound();

  const v = quoteView(q);
  const edit = can(user, "requests", "EDIT");
  const manage = can(user, "requests", "MANAGE");
  const editable = edit && isEditable(q.status);
  const options = editable ? await loadQuoteOptions(q.clientId) : null;
  const statusForm = (op: string, label: string) => (
    <ActionForm action={changeQuoteStatus} submitLabel={label} resetOnSuccess={false} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={q.id} /><input type="hidden" name="op" value={op} />
    </ActionForm>
  );

  const info: [string, React.ReactNode][] = [
    ["العميل", <Link key="c" href={`/clients/directory/${q.client.id}`} className="link">{q.client.name}</Link>],
    ["الشركة", q.company ? <Link key="co" href={`/clients/companies/${q.company.id}`} className="link">{q.company.name}</Link> : "—"],
    ["تاريخ العرض", formatDate(q.issueDate)],
    ["صالح حتى", formatDate(q.validUntil)],
    ["طريقة الدفع", q.paymentTerms ?? "—"],
    ["الرسوم الحكومية المتوقعة", q.govFees ? `${formatSAR(q.govFees)} (خارج العرض)` : "—"],
    ["أنشأه", `${q.createdBy.name} — ${formatDateTime(q.createdAt)}`],
    ...(q.sentAt ? [["تاريخ الإرسال", formatDateTime(q.sentAt)] as [string, string]] : []),
    ...(q.decidedAt ? [[q.status === "ACCEPTED" ? "تاريخ القبول" : "تاريخ الإغلاق", formatDateTime(q.decidedAt)] as [string, string]] : []),
    ...(q.rejectReason ? [["سبب الرفض", q.rejectReason] as [string, string]] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`عرض سعر ${quoteNumber(q.number)}`}
        crumbs={[{ label: "عروض الأسعار", href: "/requests/quotes" }, { label: quoteNumber(q.number) }]}
        actions={<Link href={`/requests/quotes/${q.id}/print`} className="btn-secondary"><Printer size={16} /> طباعة / PDF</Link>}
      />

      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold">{q.title}</h2>
          <Badge className={QUOTE_STATUS_STYLES[v]}>{QUOTE_STATUS_LABELS[v]}</Badge>
          {q.transaction && (
            <Link href={`/requests/all/${q.transaction.id}`} className="link flex items-center gap-1 text-sm">
              <ClipboardList size={16} /> المعاملة {txNumber(q.transaction.number)}
            </Link>
          )}
        </div>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {info.map(([l, val]) => <div key={l}><dt className="text-neutral-500">{l}</dt><dd className="font-semibold">{val}</dd></div>)}
        </dl>
      </div>

      {edit && (
        <div className="card p-5 space-y-4">
          <h2 className="text-lg font-bold">الإجراءات</h2>
          {v === "EXPIRED" && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">انتهت صلاحية هذا العرض. يمكنك تعديل تاريخ الصلاحية أو إنشاء نسخة جديدة منه.</p>}
          <div className="flex flex-wrap items-start gap-3">
            {q.status === "DRAFT" && statusForm("send", "تسجيل الإرسال للعميل")}
            {isEditable(q.status) && statusForm("accept", "قبول العميل للعرض")}
            {isEditable(q.status) && statusForm("cancel", "إلغاء العرض")}
            <ActionForm action={duplicateQuote} submitLabel="نسخ كعرض جديد" resetOnSuccess={false}><input type="hidden" name="id" value={q.id} /></ActionForm>
            {manage && q.status === "DRAFT" && (
              <ActionForm action={deleteQuote} submitLabel="حذف المسودة" resetOnSuccess={false}><input type="hidden" name="id" value={q.id} /></ActionForm>
            )}
            {manage && (q.status === "REJECTED" || q.status === "CANCELLED") && statusForm("reopen", "إعادة فتح كمسودة")}
          </div>

          {isEditable(q.status) && (
            <ActionForm action={changeQuoteStatus} submitLabel="تسجيل رفض العميل" resetOnSuccess={false} className="flex flex-wrap items-end gap-3 border-t border-neutral-100 pt-4">
              <input type="hidden" name="id" value={q.id} /><input type="hidden" name="op" value="reject" />
              <Field label="سبب الرفض (اختياري)"><input name="rejectReason" className="input min-w-72" /></Field>
            </ActionForm>
          )}

          {q.status === "ACCEPTED" && !q.transaction && (
            <ActionForm action={convertQuoteToTransaction} submitLabel="تحويل إلى معاملة" resetOnSuccess={false} className="flex flex-wrap items-end gap-3 border-t border-neutral-100 pt-4">
              <input type="hidden" name="id" value={q.id} />
              {!q.company && (
                <Field label="الشركة المنفَّذ لها *">
                  <select name="companyId" required defaultValue="" className="input min-w-64">
                    <option value="" disabled>اختر الشركة</option>
                    {q.client.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              )}
              <p className="text-xs text-neutral-600 basis-full">تُنشأ معاملة بأتعاب تساوي إجمالي العرض قبل الضريبة، والرسوم الحكومية المتوقعة، وأول خدمة من الكتالوج في البنود.</p>
            </ActionForm>
          )}
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h2 className="text-lg font-bold">البنود</h2>
        <div className="overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead><tr><th>#</th><th>الوصف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
            <tbody>
              {q.items.map((it, i) => (
                <tr key={it.id}>
                  <td>{i + 1}</td>
                  <td>{it.description}{it.serviceType && <div className="text-xs text-neutral-500">{it.serviceType.name}</div>}</td>
                  <td className="tabular-nums">{Number(it.quantity)}</td>
                  <td className="whitespace-nowrap">{formatSAR(it.unitPrice)}</td>
                  <td className="whitespace-nowrap font-semibold">{formatSAR(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mr-auto w-full max-w-sm space-y-1.5 rounded-xl bg-neutral-50 p-4 text-sm">
          <div className="flex justify-between"><dt>الإجمالي قبل الضريبة</dt><dd>{formatSAR(q.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>ضريبة القيمة المضافة {Number(q.vatRate)}%</dt><dd>{formatSAR(q.vatAmount)}</dd></div>
          <div className="flex justify-between border-t border-neutral-200 pt-1.5 text-base font-bold"><dt>الإجمالي شامل الضريبة</dt><dd>{formatSAR(q.total)}</dd></div>
        </dl>
        {q.notes && <p className="whitespace-pre-line text-sm text-neutral-700"><b>ملاحظات وشروط: </b>{q.notes}</p>}
      </div>

      {editable && options && (
        <Collapsible label="تعديل عرض السعر">
          <ActionForm action={updateQuote} submitLabel="حفظ التعديلات" resetOnSuccess={false}>
            <QuoteFields clients={options.clients} services={options.services} draft={{
              id: q.id, clientId: q.clientId, companyId: q.companyId, title: q.title, validUntil: dateInputValue(q.validUntil),
              paymentTerms: q.paymentTerms, notes: q.notes, govFees: q.govFees?.toString() ?? null,
              items: q.items.map((i) => ({ description: i.description, quantity: i.quantity.toString(), unitPrice: i.unitPrice.toString(), serviceTypeId: i.serviceTypeId })),
            }} />
          </ActionForm>
        </Collapsible>
      )}
    </div>
  );
}
