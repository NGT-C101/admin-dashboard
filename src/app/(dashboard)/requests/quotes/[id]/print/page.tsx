import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { requireSection } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { getCompanyProfile } from "@/lib/company";
import { db } from "@/lib/db";
import { formatDate, formatSAR } from "@/lib/format";
import { formatIban } from "@/lib/hr";
import { quoteNumber } from "@/lib/quotes";

// عرض السعر بصيغة A4 للطباعة أو الحفظ PDF
export default async function QuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("requests");
  const { id } = await params;
  const [q, p] = await Promise.all([
    db.quote.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, phone: true, email: true } },
        company: { select: { name: true, crNumber: true, unifiedNumber: true, vatNumber: true, nationalAddress: true, city: true } },
        items: { orderBy: { order: "asc" } },
      },
    }),
    getCompanyProfile(),
  ]);
  if (!q) notFound();
  const sellerName = p.legalName || BRAND.company;

  return (
    <div className="space-y-4">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link href={`/requests/quotes/${q.id}`} className="link text-sm">→ العودة إلى العرض</Link>
        <PrintButton />
      </div>
      {!p.vatNumber && (
        <p className="print:hidden rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          لم تُدخل بيانات المنشأة بعد (الاسم القانوني والرقم الضريبي). أدخلها من الإعدادات ← بيانات المنشأة.
        </p>
      )}
      <article className="relative isolate mx-auto max-w-3xl overflow-hidden bg-white p-8 text-[14px] text-ink shadow-sm print:overflow-visible print:p-0 print:shadow-none">
        {/* علامة مائية: شعار NGT باهت خلف المحتوى (يتكرر على كل صفحة عند الطباعة) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center print:fixed">
          <Image src={BRAND.logoOnLight} alt="" width={640} height={354} className="h-auto w-[70%] -rotate-12 opacity-[0.06]" />
        </div>
        <header className="flex items-start justify-between gap-6 border-b-4 border-navy-800 pb-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-navy-900">عرض سعر</h1>
            <p className="text-sm text-neutral-600">Quotation</p>
            <p className="pt-2 text-sm"><span className="text-neutral-500">رقم العرض: </span><b dir="ltr">{quoteNumber(q.number)}</b></p>
            <p className="text-sm"><span className="text-neutral-500">التاريخ: </span>{formatDate(q.issueDate)}</p>
            <p className="text-sm"><span className="text-neutral-500">صالح حتى: </span><b>{formatDate(q.validUntil)}</b></p>
          </div>
          <div className="text-left">
            <Image src={BRAND.logoOnLight} alt={BRAND.short} width={140} height={78} className="mr-auto h-auto w-28" />
            <p className="mt-1 text-xs text-neutral-600">{BRAND.slogan}</p>
          </div>
        </header>

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed">
            <p className="mb-1 font-bold text-navy-800">مقدّم العرض</p>
            <p className="font-semibold">{sellerName}</p>
            {p.vatNumber && <p><span className="text-neutral-500">الرقم الضريبي: </span><span dir="ltr">{p.vatNumber}</span></p>}
            {p.crNumber && <p><span className="text-neutral-500">السجل التجاري: </span><span dir="ltr">{p.crNumber}</span></p>}
            {p.address && <p>{p.address}</p>}
            {(p.phone || p.email) && <p dir="ltr" className="text-right">{[p.phone, p.email].filter(Boolean).join(" · ")}</p>}
          </div>
          <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed">
            <p className="mb-1 font-bold text-navy-800">مقدّم إلى</p>
            <p className="font-semibold">{q.company?.name ?? q.client.name}</p>
            {q.company && <p><span className="text-neutral-500">العميل: </span>{q.client.name}</p>}
            {q.company?.vatNumber && <p><span className="text-neutral-500">الرقم الضريبي: </span><span dir="ltr">{q.company.vatNumber}</span></p>}
            {(q.company?.unifiedNumber || q.company?.crNumber) && <p><span className="text-neutral-500">السجل التجاري: </span><span dir="ltr">{q.company.unifiedNumber ?? q.company.crNumber}</span></p>}
            {(q.company?.nationalAddress || q.company?.city) && <p>{[q.company.city, q.company.nationalAddress].filter(Boolean).join(" — ")}</p>}
            {q.client.phone && <p dir="ltr" className="text-right">{q.client.phone}</p>}
          </div>
        </section>

        <p className="mt-5 font-bold">الموضوع: {q.title}</p>

        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-navy-800 text-white">
              <th className="p-2 text-right font-semibold">#</th>
              <th className="p-2 text-right font-semibold">الوصف</th>
              <th className="p-2 text-right font-semibold">الكمية</th>
              <th className="p-2 text-right font-semibold">سعر الوحدة</th>
              <th className="p-2 text-right font-semibold">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((it, i) => (
              <tr key={it.id} className="border-b border-neutral-200">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">{it.description}</td>
                <td className="p-2 tabular-nums">{Number(it.quantity)}</td>
                <td className="p-2 whitespace-nowrap">{formatSAR(it.unitPrice)}</td>
                <td className="p-2 whitespace-nowrap font-semibold">{formatSAR(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt>الإجمالي قبل الضريبة</dt><dd>{formatSAR(q.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>ضريبة القيمة المضافة ({Number(q.vatRate)}%)</dt><dd>{formatSAR(q.vatAmount)}</dd></div>
            <div className="flex justify-between rounded-lg bg-navy-800 px-3 py-2 text-base font-bold text-white"><dt>الإجمالي شامل الضريبة</dt><dd>{formatSAR(q.total)}</dd></div>
          </dl>
        </div>

        {q.govFees && Number(q.govFees) > 0 && (
          <p className="mt-4 rounded-xl border border-gold-500/50 bg-gold-100/50 p-3 text-sm">
            <b>الرسوم الحكومية المتوقعة: {formatSAR(q.govFees)}</b> — تُسدَّد للجهات الحكومية المختصة، ولا تدخل ضمن قيمة هذا العرض، ولا تخضع لضريبة القيمة المضافة.
          </p>
        )}

        <section className="mt-5 space-y-2 text-sm leading-relaxed">
          {q.paymentTerms && <p><b>طريقة الدفع: </b>{q.paymentTerms}</p>}
          {q.notes && <p className="whitespace-pre-line"><b>الشروط والملاحظات: </b>{q.notes}</p>}
          <p><b>صلاحية العرض: </b>هذا العرض صالح حتى {formatDate(q.validUntil)}.</p>
          {p.iban && <p><b>الحساب البنكي: </b>{p.bankName ? `${p.bankName} — ` : ""}<span dir="ltr" className="font-mono">{formatIban(p.iban)}</span></p>}
        </section>

        <footer className="mt-10 flex justify-between border-t border-neutral-200 pt-3 text-xs text-neutral-500">
          <span>{sellerName} — {BRAND.slogan}</span>
          <span dir="ltr">{quoteNumber(q.number)}</span>
        </footer>
      </article>
    </div>
  );
}
