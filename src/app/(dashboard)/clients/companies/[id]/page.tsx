import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSignature, Plus } from "lucide-react";
import ContractsTable, { CONTRACT_INCLUDE } from "@/components/ContractsTable";
import DocumentsSection from "@/components/DocumentsSection";
import { INTERACTION_INCLUDE, InteractionForm, InteractionList } from "@/components/InteractionsSection";
import TransactionsTable, { TX_INCLUDE } from "@/components/TransactionsTable";
import ActionForm from "@/components/ui/ActionForm";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { requireSection } from "@/lib/auth";
import { daysUntil, saudizationRate } from "@/lib/clients";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { updateCompany } from "../../actions";
import { CompanyFields } from "../../fields";

const TABS = ["overview", "documents", "contracts", "communications", "transactions"] as const;

export default async function CompanyPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireSection("clients");
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? sp.tab! : "overview";

  const company = await db.company.findUnique({
    where: { id },
    include: { client: true, _count: { select: { documents: true, contracts: true, interactions: true, transactions: true } } },
  });
  if (!company) notFound();
  const base = `/clients/companies/${id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={company.name}
        crumbs={[
          { label: "العملاء", href: "/clients/directory" },
          { label: company.client.name, href: `/clients/directory/${company.client.id}` },
          { label: company.name },
        ]}
        actions={
          <>
            <Link href={`/clients/contracts/new?clientId=${company.clientId}&companyId=${id}`} className="btn-secondary"><FileSignature size={16} /> عقد</Link>
            <Link href={`/requests/all/new?companyId=${id}`} className="btn-primary"><Plus size={16} /> معاملة جديدة</Link>
          </>
        }
      />
      <Tabs base={base} current={tab} tabs={[
        { key: "overview", label: "البيانات" },
        { key: "documents", label: "المستندات", count: company._count.documents },
        { key: "contracts", label: "العقود", count: company._count.contracts },
        { key: "communications", label: "التواصل", count: company._count.interactions },
        { key: "transactions", label: "المعاملات", count: company._count.transactions },
      ]} />

      {tab === "overview" && <Overview />}
      {tab === "documents" && <Documents />}
      {tab === "contracts" && <Contracts />}
      {tab === "communications" && <Communications />}
      {tab === "transactions" && <Transactions />}
    </div>
  );

  async function Overview() {
    const c = company!;
    const clients = await db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
    const rate = saudizationRate(c.saudiCount, c.nonSaudiCount);
    const crLeft = c.crExpiry ? daysUntil(c.crExpiry) : null;
    const groups: [string, [string, React.ReactNode][]][] = [
      ["بيانات عامة", [
        ["المالك", <Link key="o" href={`/clients/directory/${c.client.id}`} className="link">{c.client.name}</Link>],
        ["الكيان القانوني", c.legalForm], ["المدينة", c.city], ["النشاط", c.activity],
      ]],
      ["الأرقام الرسمية", [
        ["السجل التجاري", c.crNumber && <span dir="ltr">{c.crNumber}</span>],
        ["انتهاء السجل", c.crExpiry && (
          <span className={crLeft! < 0 ? "text-rose-600" : crLeft! <= 60 ? "text-amber-600" : ""}>
            {formatDate(c.crExpiry)}{crLeft! < 0 ? " (منتهي)" : crLeft! <= 60 ? ` (باقي ${crLeft} يوم)` : ""}
          </span>
        )],
        ["الرقم الموحد", c.unifiedNumber && <span dir="ltr">{c.unifiedNumber}</span>],
        ["الرقم الضريبي", c.vatNumber && <span dir="ltr">{c.vatNumber}</span>],
        ["العنوان الوطني", c.nationalAddress && <span dir="ltr">{c.nationalAddress}</span>],
        ["ملف مكتب العمل", c.molFileNumber && <span dir="ltr">{c.molFileNumber}</span>],
        ["رقم التأمينات", c.gosiNumber && <span dir="ltr">{c.gosiNumber}</span>],
      ]],
      ["العمالة والسعودة", [
        ["نطاق المنشأة", c.nitaqat],
        ["سعوديين", c.saudiCount], ["غير سعوديين", c.nonSaudiCount],
        ["نسبة السعودة", rate === null ? null : (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full bg-neutral-200 overflow-hidden"><div className="h-full bg-emerald-600" style={{ width: `${rate}%` }} /></div>
            <span>{rate}%</span>
          </div>
        )],
      ]],
    ];
    return (
      <div className="space-y-6">
        {groups.map(([title, items]) => (
          <div key={title} className="card p-5">
            <h2 className="font-semibold mb-3 text-neutral-700">{title}</h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {items.map(([l, v]) => <div key={l}><dt className="text-xs text-neutral-500">{l}</dt><dd className="font-medium">{v ?? "—"}</dd></div>)}
            </dl>
          </div>
        ))}
        {c.notes && <div className="card p-5 text-sm text-neutral-600 whitespace-pre-line">{c.notes}</div>}
        <Collapsible label="تعديل بيانات الشركة">
          <ActionForm action={updateCompany} submitLabel="حفظ التعديلات" resetOnSuccess={false}>
            <CompanyFields company={c} clients={clients} />
          </ActionForm>
        </Collapsible>
      </div>
    );
  }

  async function Documents() {
    const documents = await db.document.findMany({ where: { companyId: id }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } });
    return <DocumentsSection ownerType="company" ownerId={id} documents={documents} user={user} />;
  }

  async function Contracts() {
    const contracts = await db.contract.findMany({ where: { companyId: id }, include: CONTRACT_INCLUDE, orderBy: { startDate: "desc" } });
    return (
      <div className="space-y-4">
        <Link href={`/clients/contracts/new?clientId=${company!.clientId}&companyId=${id}`} className="btn-primary"><Plus size={16} /> عقد جديد</Link>
        <ContractsTable contracts={contracts} />
      </div>
    );
  }

  async function Communications() {
    const [items, users] = await Promise.all([
      db.interaction.findMany({ where: { companyId: id }, include: INTERACTION_INCLUDE, orderBy: { occurredAt: "desc" } }),
      db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return (
      <div className="space-y-4">
        <Collapsible label="تسجيل تواصل جديد" defaultOpen={items.length === 0}>
          <InteractionForm clientId={company!.clientId} companies={[{ id, name: company!.name }]} users={users} />
        </Collapsible>
        <InteractionList items={items} user={user} />
      </div>
    );
  }

  async function Transactions() {
    const transactions = await db.transaction.findMany({ where: { companyId: id }, include: TX_INCLUDE, orderBy: { createdAt: "desc" } });
    return <TransactionsTable transactions={transactions} />;
  }
}
