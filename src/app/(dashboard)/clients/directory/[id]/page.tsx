import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, FileBarChart, FileSignature, FileText, MessageCircle, Plus, Star } from "lucide-react";
import ClientAlertsView from "@/components/ClientAlertsView";
import ContractsTable, { CONTRACT_INCLUDE } from "@/components/ContractsTable";
import DocumentsSection from "@/components/DocumentsSection";
import { INTERACTION_INCLUDE, InteractionForm, InteractionList } from "@/components/InteractionsSection";
import TransactionsTable, { TX_INCLUDE } from "@/components/TransactionsTable";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { can, requireSection } from "@/lib/auth";
import { getClientAlerts } from "@/lib/client-alerts";
import { CLIENT_STATUS_LABELS, CLIENT_STATUS_STYLES, saudizationRate, whatsappLink } from "@/lib/clients";
import { db } from "@/lib/db";
import { visibleTxWhere } from "@/lib/transactions";
import { CHANNEL_LABELS, CHANNEL_STYLES, deliveryNumber, itemLines } from "@/lib/deliveries";
import { formatDate, formatDateTime, formatSAR, txNumber } from "@/lib/format";
import { createCompany, toggleArchiveClient, updateClient } from "../../actions";
import { ClientFields, CompanyFields } from "../../fields";

const TABS = ["overview", "companies", "documents", "contracts", "communications", "transactions"] as const;

export default async function ClientPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireSection("clients");
  const { id } = await params;
  const tab = (TABS as readonly string[]).includes((await searchParams).tab ?? "") ? (await searchParams).tab! : "overview";

  const client = await db.client.findUnique({
    where: { id },
    include: {
      accountManager: { select: { name: true } },
      companies: { orderBy: { createdAt: "asc" }, include: { _count: { select: { transactions: true, documents: true } } } },
      _count: { select: { documents: true, contracts: true, interactions: true } },
    },
  });
  if (!client) notFound();

  const txWhere = { company: { clientId: id } };
  const [txCount, openTx, fees, users, lastContact] = await Promise.all([
    db.transaction.count({ where: txWhere }),
    db.transaction.count({ where: { ...txWhere, stage: { kind: "OPEN" } } }),
    db.transaction.aggregate({ where: { ...txWhere, stage: { kind: { not: "CANCELLED" } } }, _sum: { fee: true } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.interaction.findFirst({ where: { clientId: id }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } }),
  ]);
  const wa = whatsappLink(client.phone);
  const base = `/clients/directory/${id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        crumbs={[{ label: "العملاء", href: "/clients/directory" }, { label: client.name }]}
        actions={
          <>
            {wa && <a href={wa} target="_blank" rel="noopener" className="btn-secondary"><MessageCircle size={16} className="text-emerald-600" /> واتساب</a>}
            {can(user, "clients", "EDIT") && <Link href={`/clients/contracts/new?clientId=${id}`} className="btn-secondary"><FileSignature size={16} /> عقد</Link>}
            {can(user, "requests", "EDIT") && <Link href={`/requests/quotes/new?clientId=${id}`} className="btn-secondary"><FileText size={16} /> عرض سعر</Link>}
            {can(user, "requests", "EDIT") && <Link href={`/requests/all/new?clientId=${id}`} className="btn-primary"><Plus size={16} /> معاملة جديدة</Link>}
          </>
        }
      />
      {client.archivedAt && (
        <div className="rounded-lg bg-neutral-200 p-3 text-sm text-neutral-700">
          📦 هذا العميل مؤرشف منذ {formatDate(client.archivedAt)}، ولا يظهر في القوائم والتنبيهات.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 -mt-3">
        <Badge className={CLIENT_STATUS_STYLES[client.status]}>{CLIENT_STATUS_LABELS[client.status]}</Badge>
        {client.vip && <Badge className="bg-amber-50 text-amber-700 ring-amber-200"><Star size={12} className="inline -mt-0.5" /> مميز</Badge>}
        {client.accountManager && <span className="text-sm text-neutral-600">المسؤول: <b>{client.accountManager.name}</b></span>}
        <div className="mr-auto flex gap-2">
          <Link href={`/clients/directory/${id}/report`} className="btn-secondary !py-1.5"><FileBarChart size={15} /> التقرير الشهري</Link>
          {can(user, "clients", "MANAGE") && (
            <form action={toggleArchiveClient}>
              <input type="hidden" name="id" value={id} />
              <button className="btn-secondary !py-1.5">
                {client.archivedAt ? <><ArchiveRestore size={15} /> إلغاء الأرشفة</> : <><Archive size={15} /> أرشفة</>}
              </button>
            </form>
          )}
        </div>
      </div>

      <Tabs base={base} current={tab} tabs={[
        { key: "overview", label: "نظرة عامة" },
        { key: "companies", label: "الشركات", count: client.companies.length },
        { key: "documents", label: "المستندات", count: client._count.documents },
        { key: "contracts", label: "العقود", count: client._count.contracts },
        { key: "communications", label: "التواصل", count: client._count.interactions },
        { key: "transactions", label: "المعاملات", count: txCount },
      ]} />

      {tab === "overview" && <Overview />}
      {tab === "companies" && <Companies />}
      {tab === "documents" && <Documents />}
      {tab === "contracts" && <Contracts />}
      {tab === "communications" && <Communications />}
      {tab === "transactions" && <Transactions />}
    </div>
  );

  async function Overview() {
    const alerts = await getClientAlerts({ clientId: id });
    const info: [string, React.ReactNode][] = [
      ["رقم الهوية / الإقامة", client!.nationalId],
      ["الجوال", client!.phone && <span dir="ltr">{client!.phone}</span>],
      ["جوال آخر", client!.phone2 && <span dir="ltr">{client!.phone2}</span>],
      ["البريد", client!.email],
      ["الجنسية", client!.nationality],
      ["المدينة", client!.city],
      ["المصدر", client!.source],
      ["تاريخ التسجيل", formatDate(client!.createdAt)],
    ];
    const stats = [
      ["الشركات", client!.companies.length],
      ["معاملات جارية", openTx],
      ["كل المعاملات", txCount],
      ["إجمالي الأتعاب", formatSAR(fees._sum.fee ?? 0)],
      ["آخر تواصل", lastContact ? formatDateTime(lastContact.occurredAt) : "—"],
    ];
    return (
      <div className="space-y-6">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {stats.map(([l, v]) => (
            <div key={l as string} className="card p-4"><div className="text-lg font-bold">{v}</div><div className="text-xs text-neutral-500">{l}</div></div>
          ))}
        </div>
        <div className="card p-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {info.map(([l, v]) => <div key={l}><dt className="text-xs text-neutral-500">{l}</dt><dd className="font-medium">{v || "—"}</dd></div>)}
          </dl>
          {client!.notes && <p className="mt-4 text-sm text-neutral-600 whitespace-pre-line border-t border-neutral-100 pt-4">{client!.notes}</p>}
        </div>
        {can(user, "clients", "EDIT") && (
          <Collapsible label="تعديل بيانات العميل">
            <ActionForm action={updateClient} submitLabel="حفظ التعديلات" resetOnSuccess={false}>
              <ClientFields client={client!} users={users} />
            </ActionForm>
          </Collapsible>
        )}
        <h2 className="text-lg font-semibold">تنبيهات العميل</h2>
        <ClientAlertsView alerts={alerts} hideClient />
      </div>
    );
  }

  function Companies() {
    return (
      <div className="space-y-4">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>الشركة</th><th>السجل التجاري</th><th>انتهاء السجل</th><th>النطاق</th><th>السعودة</th><th>المعاملات</th><th>المستندات</th></tr></thead>
            <tbody>
              {client!.companies.map((co) => {
                const rate = saudizationRate(co.saudiCount, co.nonSaudiCount);
                return (
                  <tr key={co.id}>
                    <td><Link href={`/clients/companies/${co.id}`} className="link">{co.name}</Link><div className="text-xs text-neutral-500">{co.city}</div></td>
                    <td dir="ltr" className="text-right">{co.crNumber ?? "—"}</td>
                    <td>{formatDate(co.crExpiry)}</td>
                    <td>{co.nitaqat ?? "—"}</td>
                    <td>{rate === null ? "—" : `${rate}%`}</td>
                    <td>{co._count.transactions}</td>
                    <td>{co._count.documents}</td>
                  </tr>
                );
              })}
              {client!.companies.length === 0 && <tr><td colSpan={7} className="text-center text-neutral-500 py-8">لا توجد شركات مسجّلة</td></tr>}
            </tbody>
          </table>
        </div>
        {can(user, "clients", "EDIT") && (
          <Collapsible label="إضافة شركة للعميل">
            <ActionForm action={createCompany} submitLabel="حفظ الشركة"><CompanyFields clientId={id} /></ActionForm>
          </Collapsible>
        )}
      </div>
    );
  }

  async function Documents() {
    const documents = await db.document.findMany({ where: { clientId: id }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } });
    return (
      <div className="space-y-3">
        <DocumentsSection ownerType="client" ownerId={id} documents={documents} userId={user.id} canUpload={can(user, "clients", "EDIT")} canManage={can(user, "clients", "MANAGE")} />
        {client!.companies.length > 0 && (
          <p className="text-sm text-neutral-600">
            💡 تُحفظ مستندات الشركات (السجل، الرخص، الشهادات) في صفحة كل شركة:{" "}
            {client!.companies.map((co, i) => (
              <span key={co.id}>{i > 0 && "، "}<Link href={`/clients/companies/${co.id}?tab=documents`} className="link">{co.name}</Link> ({co._count.documents})</span>
            ))}
          </p>
        )}
      </div>
    );
  }

  async function Contracts() {
    const contracts = await db.contract.findMany({ where: { clientId: id }, include: CONTRACT_INCLUDE, orderBy: { startDate: "desc" } });
    return (
      <div className="space-y-4">
        {can(user, "clients", "EDIT") && <Link href={`/clients/contracts/new?clientId=${id}`} className="btn-primary"><Plus size={16} /> عقد جديد</Link>}
        <ContractsTable contracts={contracts} />
      </div>
    );
  }

  async function Communications() {
    const items = await db.interaction.findMany({ where: { clientId: id }, include: INTERACTION_INCLUDE, orderBy: { occurredAt: "desc" } });
    return (
      <div className="space-y-4">
        {can(user, "clients", "EDIT") && (
          <Collapsible label="تسجيل تواصل جديد" defaultOpen={items.length === 0}>
            <InteractionForm clientId={id} companies={client!.companies} users={users} />
          </Collapsible>
        )}
        <InteractionList items={items} user={user} />
      </div>
    );
  }

  async function Transactions() {
    const [transactions, deliveries] = await Promise.all([
      db.transaction.findMany({ where: { ...txWhere, ...visibleTxWhere(user) }, include: TX_INCLUDE, orderBy: { createdAt: "desc" } }),
      db.delivery.findMany({
        where: { transaction: { ...txWhere, ...visibleTxWhere(user) } },
        include: { transaction: { select: { id: true, number: true, title: true } }, _count: { select: { documents: true } } },
        orderBy: { deliveredAt: "desc" },
      }),
    ]);
    const seeRequests = can(user, "requests");
    return (
      <div className="space-y-6">
        <TransactionsTable transactions={transactions} showCompany />
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">سجل تسليم المخرجات <span className="text-sm font-normal text-neutral-500">({deliveries.length})</span></h2>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>رقم التسليم</th><th>التاريخ</th><th>المعاملة</th><th>المستلم</th><th>الطريقة</th><th>المخرجات</th></tr></thead>
              <tbody>
                {deliveries.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-neutral-500">لا توجد تسليمات</td></tr>}
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td dir="ltr" className="text-right whitespace-nowrap">
                      {seeRequests ? <Link href={`/requests/deliverables/${d.id}/receipt`} className="link">{deliveryNumber(d.number)}</Link> : deliveryNumber(d.number)}
                    </td>
                    <td className="whitespace-nowrap text-sm">{formatDateTime(d.deliveredAt)}</td>
                    <td><Link href={`/requests/all/${d.transaction.id}`} className="link" dir="ltr">{txNumber(d.transaction.number)}</Link> {d.transaction.title}</td>
                    <td>{d.recipientName}</td>
                    <td><Badge className={CHANNEL_STYLES[d.channel]}>{CHANNEL_LABELS[d.channel]}</Badge></td>
                    <td>{d._count.documents + itemLines(d.items).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }
}
