import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { requireSection } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { getCompanyProfile } from "@/lib/company";
import { db } from "@/lib/db";
import { CHANNEL_LABELS, deliveryNumber, itemLines } from "@/lib/deliveries";
import { DOC_TYPE_LABELS } from "@/lib/documents";
import { formatDate, formatDateTime, txNumber } from "@/lib/format";

// إيصال تسليم المخرجات بصيغة A4 للطباعة والتوقيع
export default async function DeliveryReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("requests");
  const { id } = await params;
  const [d, p] = await Promise.all([
    db.delivery.findUnique({
      where: { id },
      include: {
        transaction: {
          select: {
            id: true, number: true, title: true, platformRef: true,
            serviceType: { select: { name: true } }, govEntity: { select: { name: true } },
            company: { select: { name: true, crNumber: true, unifiedNumber: true, client: { select: { name: true, phone: true } } } },
          },
        },
        documents: { select: { id: true, type: true, title: true, expiresAt: true } },
        deliveredBy: { select: { name: true } },
      },
    }),
    getCompanyProfile(),
  ]);
  if (!d) notFound();
  const t = d.transaction;
  const sellerName = p.legalName || BRAND.company;
  const rows = [
    ...d.documents.map((x) => ({ key: x.id, label: DOC_TYPE_LABELS[x.type] + (x.title ? `: ${x.title}` : ""), kind: "نسخة إلكترونية", expiry: x.expiresAt })),
    ...itemLines(d.items).map((l, i) => ({ key: `i${i}`, label: l, kind: "أصل / ورقي", expiry: null })),
  ];

  return (
    <div className="space-y-4">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link href={`/requests/all/${t.id}#delivery`} className="link text-sm">→ العودة إلى المعاملة</Link>
        <PrintButton />
      </div>
      <article className="relative isolate mx-auto max-w-3xl overflow-hidden bg-white p-8 text-[14px] text-ink shadow-sm print:overflow-visible print:p-0 print:shadow-none">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center print:fixed">
          <Image src={BRAND.logoOnLight} alt="" width={640} height={354} className="h-auto w-[70%] -rotate-12 opacity-[0.06]" />
        </div>
        <header className="flex items-start justify-between gap-6 border-b-4 border-navy-800 pb-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-navy-900">إيصال تسليم مخرجات</h1>
            <p className="text-sm text-neutral-600">Delivery Receipt</p>
            <p className="pt-2 text-sm"><span className="text-neutral-500">رقم الإيصال: </span><b dir="ltr">{deliveryNumber(d.number)}</b></p>
            <p className="text-sm"><span className="text-neutral-500">تاريخ التسليم: </span>{formatDateTime(d.deliveredAt)}</p>
            <p className="text-sm"><span className="text-neutral-500">طريقة التسليم: </span>{CHANNEL_LABELS[d.channel]}</p>
          </div>
          <div className="text-left">
            <Image src={BRAND.logoOnLight} alt={BRAND.short} width={140} height={78} className="mr-auto h-auto w-28" />
            <p className="mt-1 text-xs text-neutral-600">{BRAND.slogan}</p>
          </div>
        </header>

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed">
            <p className="mb-1 font-bold text-navy-800">الجهة المسلِّمة</p>
            <p className="font-semibold">{sellerName}</p>
            {p.crNumber && <p><span className="text-neutral-500">الرقم الموحد: </span><span dir="ltr">{p.crNumber}</span></p>}
            {(p.phone || p.email) && <p dir="ltr" className="text-right">{[p.phone, p.email].filter(Boolean).join(" · ")}</p>}
          </div>
          <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed">
            <p className="mb-1 font-bold text-navy-800">العميل</p>
            <p className="font-semibold">{t.company.name}</p>
            <p><span className="text-neutral-500">العميل: </span>{t.company.client.name}</p>
            {t.company.unifiedNumber
              ? <p><span className="text-neutral-500">الرقم الموحد: </span><span dir="ltr">{t.company.unifiedNumber}</span></p>
              : t.company.crNumber && <p><span className="text-neutral-500">السجل التجاري: </span><span dir="ltr">{t.company.crNumber}</span></p>}
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-neutral-200 p-4 text-sm leading-relaxed">
          <p><span className="text-neutral-500">المعاملة: </span><b dir="ltr">{txNumber(t.number)}</b> — {t.title}</p>
          {(t.serviceType || t.govEntity) && <p><span className="text-neutral-500">الخدمة: </span>{[t.govEntity?.name, t.serviceType?.name].filter(Boolean).join(" — ")}</p>}
          {t.platformRef && <p><span className="text-neutral-500">رقم الطلب على المنصة: </span><span dir="ltr">{t.platformRef}</span></p>}
        </section>

        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-navy-800 text-white">
              <th className="p-2 text-right font-semibold">#</th>
              <th className="p-2 text-right font-semibold">البيان</th>
              <th className="p-2 text-right font-semibold">النوع</th>
              <th className="p-2 text-right font-semibold">تاريخ الانتهاء</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className="border-b border-neutral-200">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">{r.label}</td>
                <td className="p-2 whitespace-nowrap">{r.kind}</td>
                <td className="p-2 whitespace-nowrap">{r.expiry ? formatDate(r.expiry) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {d.note && <p className="mt-4 whitespace-pre-line text-sm"><b>ملاحظات: </b>{d.note}</p>}

        <p className="mt-6 rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed">
          أقرّ أنا الموقّع أدناه بأنني استلمت المخرجات الموضحة أعلاه كاملةً وبحالة سليمة، وذلك بتاريخ {formatDate(d.deliveredAt)}.
        </p>

        <section className="mt-8 grid gap-8 text-sm sm:grid-cols-2 print:grid-cols-2">
          <div className="space-y-3">
            <p className="font-bold text-navy-800">المستلم</p>
            <p><span className="text-neutral-500">الاسم: </span>{d.recipientName}</p>
            <p><span className="text-neutral-500">رقم الهوية: </span>{d.recipientIdNo ? <span dir="ltr">{d.recipientIdNo}</span> : "...................................."}</p>
            <p><span className="text-neutral-500">التوقيع: </span>....................................</p>
          </div>
          <div className="space-y-3">
            <p className="font-bold text-navy-800">المسلِّم</p>
            <p><span className="text-neutral-500">الاسم: </span>{d.deliveredBy.name}</p>
            <p><span className="text-neutral-500">التوقيع: </span>....................................</p>
            <p><span className="text-neutral-500">الختم: </span></p>
          </div>
        </section>

        <footer className="mt-10 flex justify-between border-t border-neutral-200 pt-3 text-xs text-neutral-500">
          <span>{sellerName} — {BRAND.slogan}</span>
          <span dir="ltr">{deliveryNumber(d.number)} · {txNumber(t.number)}</span>
        </footer>
      </article>
    </div>
  );
}
