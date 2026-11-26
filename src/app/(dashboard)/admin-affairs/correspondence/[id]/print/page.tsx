import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { requireSection } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { getCompanyProfile } from "@/lib/company";
import { db } from "@/lib/db";
import { formatDateFull, formatHijri } from "@/lib/format";
import { SECTION, letterNumber, qrSvg, verifyUrl } from "@/lib/letters";

// الخطاب الصادر على ترويسة المنشأة (A4) — غير المعتمد يُطبع كمسودة دون رقم أو رمز تحقق
export default async function LetterPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection(SECTION);
  const { id } = await params;
  const [l, p] = await Promise.all([
    db.letter.findUnique({
      where: { id },
      include: {
        approvedBy: { select: { name: true, employee: { select: { jobTitle: true } } } },
        _count: { select: { documents: true } },
      },
    }),
    getCompanyProfile(),
  ]);
  if (!l || l.direction !== "OUTGOING") notFound();
  const approved = l.status === "APPROVED";
  const num = letterNumber(l);
  const date = l.letterDate ?? new Date();
  const qr = approved && l.verifyToken ? await qrSvg(await verifyUrl(l.verifyToken)) : null;
  const sellerName = p.legalName || BRAND.company;

  return (
    <div className="space-y-4">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin-affairs/correspondence/${l.id}`} className="link text-sm">→ العودة إلى الخطاب</Link>
        <PrintButton />
      </div>
      {!approved && (
        <p className="print:hidden rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          هذه معاينة لخطاب غير معتمد: تُطبع بعلامة «مسودة» ودون رقم صادر أو رمز تحقق.
        </p>
      )}
      <article className="relative isolate mx-auto flex min-h-[297mm] max-w-[210mm] flex-col overflow-hidden bg-white p-12 text-[15px] leading-loose text-ink shadow-sm print:min-h-0 print:overflow-visible print:p-0 print:shadow-none">
        {!approved && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center print:fixed">
            <span className="-rotate-30 text-[110px] font-extrabold text-rose-600/10">مسودة</span>
          </div>
        )}
        <header className="flex items-start justify-between gap-6 border-b-2 border-navy-800 pb-4">
          <div className="space-y-0.5 text-sm">
            <p><span className="text-neutral-500">الرقم: </span><b><bdi>{num ?? "—"}</bdi></b></p>
            <p><span className="text-neutral-500">التاريخ: </span>{formatHijri(date)}</p>
            <p><span className="text-neutral-500">الموافق: </span>{formatDateFull(date)}</p>
            <p><span className="text-neutral-500">المرفقات: </span>{l._count.documents || "—"}</p>
          </div>
          {!l.hideLogo && (
            <div className="text-left">
              <Image src={BRAND.logoOnLight} alt={BRAND.short} width={150} height={83} className="mr-auto h-auto w-32" />
              <p className="mt-1 text-xs font-semibold text-navy-900">{sellerName}</p>
            </div>
          )}
        </header>

        <section className="mt-8 space-y-1">
          <p className="font-bold">السادة / {l.party}</p>
          <p className="font-semibold">المحترمين</p>
          <p className="pt-3"><b>الموضوع: </b>{l.subject}</p>
          {l.partyRef && <p className="text-sm text-neutral-600">إشارة إلى: {l.partyRef}</p>}
        </section>

        <div className="mt-6 flex-1 whitespace-pre-line text-justify">{l.body}</div>

        <section className="mt-10 flex items-end justify-between gap-6">
          <div className="text-center">
            {approved && l.approvedBy ? (
              <>
                <p className="font-bold">{l.approvedBy.name}</p>
                {l.approvedBy.employee?.jobTitle && <p className="text-sm">{l.approvedBy.employee.jobTitle}</p>}
              </>
            ) : <p className="text-sm text-neutral-400">(يُعتمد لاحقاً)</p>}
            <p className="mt-2 text-sm text-neutral-500">{sellerName}</p>
          </div>
          {qr && (
            <div className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3">
              <p className="max-w-44 text-xs leading-relaxed text-neutral-600">
                خطاب صادر ومعتمد إلكترونياً من {BRAND.name}. للتحقق من صحته امسح الرمز.
              </p>
              <div className="size-24 shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
            </div>
          )}
        </section>

        {!l.hideLogo && (
          <footer className="mt-8 border-t border-neutral-200 pt-3 text-center text-xs text-neutral-500">
            {[sellerName, p.crNumber && `الرقم الموحد ${p.crNumber}`, p.address, p.phone, p.email].filter(Boolean).join(" · ")}
          </footer>
        )}
      </article>
    </div>
  );
}
