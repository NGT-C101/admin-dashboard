import { MonthField } from "@/components/ui/DateField";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import StageBadge from "@/components/ui/StageBadge";
import { contractNumber } from "@/components/ContractsTable";
import { requireSection } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { getClientAlerts } from "@/lib/client-alerts";
import { CONTRACT_STATE_LABELS, CONTRACT_TYPE_LABELS, INTERACTION_TYPE_LABELS, contractState, daysText, daysUntil, saudizationRate } from "@/lib/clients";
import { db } from "@/lib/db";
import { visibleTxWhere } from "@/lib/transactions";
import { DOC_TYPE_LABELS } from "@/lib/documents";
import { formatDate, txNumber } from "@/lib/format";

// حدود الشهر بتوقيت السعودية
function monthRange(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const start = new Date(Date.UTC(y, mo - 1, 1) - 3 * 3600000);
  const end = new Date(Date.UTC(y, mo, 1) - 3 * 3600000);
  return { start, end };
}
function currentMonth() {
  const d = new Date(Date.now() + 3 * 3600000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const monthName = (m: string) =>
  new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-15T00:00:00Z`));

export default async function ClientReport({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireSection("clients");
  const { id } = await params;
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const { start, end } = monthRange(month);

  const client = await db.client.findUnique({ where: { id }, include: { companies: { orderBy: { name: "asc" } } } });
  if (!client) notFound();
  const txWhere = { company: { clientId: id } };

  const [txs, created, completedEvents, interactions, contracts, alerts] = await Promise.all([
    // المعاملات اللي حصل فيها أي حاجة الشهر ده أو لسه جارية
    db.transaction.findMany({
      where: { ...txWhere, AND: [visibleTxWhere(user), { OR: [{ stage: { kind: "OPEN" } }, { events: { some: { createdAt: { gte: start, lt: end } } } }] }] },
      include: {
        company: { select: { name: true } }, stage: true, govEntity: { select: { name: true } }, serviceType: { select: { name: true } },
        // للعميل: التعليقات الخارجية فقط (التعليقات الداخلية لفريق العمل)
        events: { where: { createdAt: { gte: start, lt: end }, note: { not: null }, external: true }, orderBy: { createdAt: "desc" }, take: 1, select: { note: true } },
      },
      orderBy: { number: "asc" },
    }),
    db.transaction.count({ where: { ...txWhere, createdAt: { gte: start, lt: end } } }),
    db.transactionEvent.findMany({
      where: { transaction: txWhere, createdAt: { gte: start, lt: end }, stage: { kind: "DONE" } },
      select: { transactionId: true }, distinct: ["transactionId"],
    }),
    db.interaction.findMany({ where: { clientId: id, occurredAt: { gte: start, lt: end } }, orderBy: { occurredAt: "asc" } }),
    db.contract.findMany({ where: { clientId: id, cancelledAt: null }, orderBy: { startDate: "desc" }, include: { company: { select: { name: true } } } }),
    getClientAlerts({ clientId: id }),
  ]);
  const open = txs.filter((t) => t.stage.kind === "OPEN").length;
  const liveContracts = contracts.filter((c) => ["active", "ending"].includes(contractState(c)));

  const H = ({ children }: { children: React.ReactNode }) => (
    <h2 className="mt-8 mb-3 border-r-4 border-brand-700 pr-3 text-lg font-bold text-brand-900 break-after-avoid">{children}</h2>
  );

  return (
    <div className="space-y-4">
      <div className="print:hidden flex flex-wrap items-end justify-between gap-3">
        <div className="text-sm"><Link href={`/clients/directory/${id}`} className="link">← العودة إلى ملف العميل</Link></div>
        <form className="flex items-end gap-2">
          <label className="text-sm space-y-1"><span className="block text-neutral-600">الشهر</span>
            <MonthField name="month" defaultValue={month} /></label>
          <button className="btn-secondary">عرض</button>
          <PrintButton />
        </form>
      </div>

      <article className="mx-auto max-w-4xl bg-white p-8 shadow-sm print:shadow-none print:p-0 print:max-w-none text-[15px]">
        <header className="flex items-center justify-between border-b-4 border-brand-700 pb-5">
          <div>
            <p className="text-sm text-neutral-500">التقرير الشهري</p>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <p className="text-brand-800 font-semibold">{monthName(month)}</p>
          </div>
          <div className="text-left">
            <Image src={BRAND.logoOnLight} alt={BRAND.short} width={130} height={72} className="w-28 h-auto mr-auto" />
            <p className="text-xs text-neutral-500 mt-1">{BRAND.company}</p>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-4 gap-3 text-center">
          {[["معاملات جديدة", created], ["معاملات أُنجزت", completedEvents.length], ["معاملات جارية", open], ["تواصل خلال الشهر", interactions.length]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg border border-neutral-200 p-3">
              <div className="text-2xl font-bold text-brand-800">{v}</div><div className="text-xs text-neutral-600">{l}</div>
            </div>
          ))}
        </section>

        <H>المعاملات</H>
        {txs.length === 0 ? <p className="text-neutral-500">لا توجد معاملات خلال هذا الشهر.</p> : (
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-neutral-100 text-right">
              <th className="p-2">الرقم</th><th className="p-2">المعاملة</th><th className="p-2">الجهة</th><th className="p-2">الحالة</th><th className="p-2">آخر تحديث</th>
            </tr></thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-b border-neutral-100 align-top break-inside-avoid">
                  <td className="p-2 whitespace-nowrap" dir="ltr">{txNumber(t.number)}</td>
                  <td className="p-2">{t.title}<div className="text-xs text-neutral-500">{t.company.name}{t.serviceType ? ` · ${t.serviceType.name}` : ""}</div></td>
                  <td className="p-2">{t.govEntity?.name ?? "—"}</td>
                  <td className="p-2"><StageBadge name={t.stage.name} kind={t.stage.kind} /></td>
                  <td className="p-2 text-xs text-neutral-600">{t.events[0]?.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <H>حالة المنشآت</H>
        <table className="w-full text-sm border-collapse">
          <thead><tr className="bg-neutral-100 text-right">
            <th className="p-2">المنشأة</th><th className="p-2">السجل التجاري</th><th className="p-2">انتهاء السجل</th><th className="p-2">النطاق</th><th className="p-2">السعودة</th>
          </tr></thead>
          <tbody>
            {client.companies.map((co) => {
              const left = co.crExpiry ? daysUntil(co.crExpiry) : null;
              const rate = saudizationRate(co.saudiCount, co.nonSaudiCount);
              return (
                <tr key={co.id} className="border-b border-neutral-100">
                  <td className="p-2 font-medium">{co.name}</td>
                  <td className="p-2" dir="ltr">{co.crNumber ?? "—"}</td>
                  <td className={`p-2 ${left !== null && left < 0 ? "text-rose-700 font-semibold" : left !== null && left <= 60 ? "text-amber-700 font-semibold" : ""}`}>
                    {formatDate(co.crExpiry)}{left !== null && left < 0 ? " (منتهٍ)" : left !== null && left <= 60 ? ` (متبقٍ ${daysText(left)})` : ""}
                  </td>
                  <td className="p-2">{co.nitaqat ?? "—"}</td>
                  <td className="p-2">{rate === null ? "—" : `${rate}%`}</td>
                </tr>
              );
            })}
            {client.companies.length === 0 && <tr><td colSpan={5} className="p-2 text-neutral-500">لا توجد منشآت مسجّلة</td></tr>}
          </tbody>
        </table>

        <H>مستندات وشهادات تتطلب المتابعة</H>
        {alerts.documents.length === 0 ? <p className="text-emerald-700">✅ جميع المستندات سارية.</p> : (
          <ul className="space-y-1 text-sm">
            {alerts.documents.map((d) => {
              const left = daysUntil(d.expiresAt!);
              return (
                <li key={d.id} className={`rounded px-3 py-1.5 ${left < 0 ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"}`}>
                  <b>{DOC_TYPE_LABELS[d.type]}</b>{d.title ? ` (${d.title})` : ""} — {d.company?.name ?? client.name} — {formatDate(d.expiresAt)}
                  {left < 0 ? " · منتهٍ ويحتاج إلى تجديد" : ` · متبقٍ ${daysText(left)}`}
                </li>
              );
            })}
          </ul>
        )}

        {liveContracts.length > 0 && (
          <>
            <H>العقود والباقات</H>
            <ul className="space-y-1 text-sm">
              {liveContracts.map((c) => (
                <li key={c.id}>{contractNumber(c.number)} · <b>{c.title}</b> · {CONTRACT_TYPE_LABELS[c.type]}{c.company ? ` · ${c.company.name}` : ""} ·{" "}
                  {CONTRACT_STATE_LABELS[contractState(c)]}{c.endDate ? ` حتى ${formatDate(c.endDate)}` : ""}</li>
              ))}
            </ul>
          </>
        )}

        {interactions.length > 0 && (
          <>
            <H>سجل التواصل خلال الشهر</H>
            <ul className="space-y-1 text-sm">
              {interactions.map((i) => <li key={i.id}><span className="text-neutral-500">{formatDate(i.occurredAt)} · {INTERACTION_TYPE_LABELS[i.type]}:</span> {i.summary}</li>)}
            </ul>
          </>
        )}

        <footer className="mt-10 flex justify-between border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          <span>{BRAND.company} — {BRAND.slogan}</span>
          <span>تاريخ الإصدار: {formatDate(new Date())}</span>
        </footer>
      </article>
    </div>
  );
}
