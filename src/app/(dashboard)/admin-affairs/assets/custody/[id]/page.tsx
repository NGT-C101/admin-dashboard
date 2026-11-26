import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { SECTION, assetNumber, custodyPledge } from "@/lib/assets";
import { can, requireUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { getCompanyProfile } from "@/lib/company";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";

const empNo = (n: number) => `EMP-${String(n).padStart(4, "0")}`;

// نموذج استلام عهدة (A4) للتوقيع — للشؤون الإدارية وللموظف صاحب العهدة
export default async function CustodyFormPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [c, p] = await Promise.all([
    db.custody.findUnique({
      where: { id },
      include: {
        asset: { include: { category: { select: { name: true } } } },
        employee: { select: { id: true, number: true, fullName: true, jobTitle: true, nationalId: true } },
        assignedBy: { select: { name: true } }, receivedBy: { select: { name: true } },
      },
    }),
    getCompanyProfile(),
  ]);
  if (!c || !(can(user, SECTION) || user.employeeId === c.employee.id)) notFound();
  const a = c.asset;
  const pledge = c.ackText ?? custodyPledge({ employee: c.employee.fullName, asset: a.name, number: assetNumber(a.number), serial: a.serialNumber, condition: c.conditionOut });
  const org = p.legalName || BRAND.company;
  const back = can(user, SECTION) ? `/admin-affairs/assets/${a.id}` : "/me";

  return (
    <div className="space-y-4">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link href={back} className="link text-sm">→ رجوع</Link>
        <PrintButton />
      </div>
      <article className="relative isolate mx-auto max-w-3xl overflow-hidden bg-white p-8 text-[14px] leading-relaxed text-ink shadow-sm print:overflow-visible print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-4 border-navy-800 pb-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-navy-900">نموذج استلام عهدة</h1>
            <p className="text-sm text-neutral-600">{org}</p>
            <p className="text-sm"><span className="text-neutral-500">تاريخ التسليم: </span>{formatDate(c.assignedAt)}</p>
          </div>
          <Image src={BRAND.logoOnLight} alt={BRAND.short} width={140} height={78} className="h-auto w-28" />
        </header>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <div className="rounded-xl bg-neutral-50 p-4 text-sm">
            <p className="mb-1 font-bold text-navy-800">الموظف المستلم</p>
            <p className="font-semibold">{c.employee.fullName}</p>
            <p><span className="text-neutral-500">الرقم الوظيفي: </span><span dir="ltr">{empNo(c.employee.number)}</span></p>
            <p><span className="text-neutral-500">المسمى الوظيفي: </span>{c.employee.jobTitle}</p>
            {c.employee.nationalId && <p><span className="text-neutral-500">رقم الهوية: </span><span dir="ltr">{c.employee.nationalId}</span></p>}
          </div>
          <div className="rounded-xl bg-neutral-50 p-4 text-sm">
            <p className="mb-1 font-bold text-navy-800">بيانات العهدة</p>
            <p className="font-semibold">{a.name}</p>
            <p><span className="text-neutral-500">رقم الأصل: </span><span dir="ltr">{assetNumber(a.number)}</span></p>
            <p><span className="text-neutral-500">التصنيف: </span>{a.category.name}</p>
            {a.brand && <p><span className="text-neutral-500">الماركة / الموديل: </span>{a.brand}</p>}
            {a.serialNumber && <p><span className="text-neutral-500">الرقم التسلسلي: </span><span dir="ltr">{a.serialNumber}</span></p>}
            {c.conditionOut && <p><span className="text-neutral-500">الحالة عند التسليم: </span>{c.conditionOut}</p>}
          </div>
        </section>

        <section className="mt-6">
          <p className="mb-2 font-bold">الإقرار والتعهد</p>
          <p className="whitespace-pre-line rounded-xl border border-neutral-200 p-4">{pledge}</p>
          {c.acknowledgedAt && (
            <p className="mt-2 text-xs text-emerald-700">
              {c.ackMethod === "PAPER" ? "وُقّع هذا النموذج ورقياً وسُجّل في المنصة" : "أقرّ الموظف بهذا عبر المنصة"} بتاريخ {formatDateTime(c.acknowledgedAt)}.
            </p>
          )}
        </section>

        <section className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <div className="space-y-3">
            <p className="font-bold text-navy-800">الموظف المستلم</p>
            <p><span className="text-neutral-500">الاسم: </span>{c.employee.fullName}</p>
            <p><span className="text-neutral-500">التوقيع: </span>....................................</p>
          </div>
          <div className="space-y-3">
            <p className="font-bold text-navy-800">المسلِّم (الشؤون الإدارية)</p>
            <p><span className="text-neutral-500">الاسم: </span>{c.assignedBy.name}</p>
            <p><span className="text-neutral-500">التوقيع: </span>....................................</p>
          </div>
        </section>

        {c.returnedAt && (
          <section className="mt-8 rounded-xl border-2 border-emerald-200 p-4 text-sm">
            <p className="font-bold text-emerald-800">إخلاء العهدة</p>
            <p>أُعيد الأصل بتاريخ {formatDate(c.returnedAt)}{c.conditionIn && ` بحالة: ${c.conditionIn}`}، واستلمه {c.receivedBy?.name ?? "—"}.</p>
            {c.returnNote && <p className="text-neutral-600">{c.returnNote}</p>}
          </section>
        )}

        <footer className="mt-10 flex justify-between border-t border-neutral-200 pt-3 text-xs text-neutral-500">
          <span>{org} — {BRAND.slogan}</span>
          <span dir="ltr">{assetNumber(a.number)}</span>
        </footer>
      </article>
    </div>
  );
}
