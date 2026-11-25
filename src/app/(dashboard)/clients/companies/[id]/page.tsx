import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import TransactionsTable, { TX_INCLUDE } from "@/components/TransactionsTable";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { updateCompany } from "../../actions";
import { CompanyFields } from "../../fields";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("clients");
  const { id } = await params;
  const company = await db.company.findUnique({ where: { id }, include: { client: true } });
  if (!company) notFound();

  const [transactions, clients] = await Promise.all([
    db.transaction.findMany({ where: { companyId: id }, include: TX_INCLUDE, orderBy: { createdAt: "desc" } }),
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const info: [string, React.ReactNode][] = [
    ["المالك", <Link key="o" href={`/clients/directory/${company.client.id}`} className="link">{company.client.name}</Link>],
    ["السجل التجاري", company.crNumber],
    ["الرقم الموحد", company.unifiedNumber],
    ["الكيان القانوني", company.legalForm],
    ["المدينة", company.city],
    ["النشاط", company.activity],
    ["انتهاء السجل", formatDate(company.crExpiry)],
  ];

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
          <Link href={`/requests/all/new?companyId=${company.id}`} className="btn-primary">
            <Plus size={16} /> معاملة جديدة
          </Link>
        }
      />

      <div className="card p-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {info.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-neutral-500">{label}</dt>
              <dd className="font-medium" dir="auto">{value || "—"}</dd>
            </div>
          ))}
        </dl>
        {company.notes && <p className="mt-4 text-sm text-neutral-600 whitespace-pre-line">{company.notes}</p>}
      </div>

      <Collapsible label="تعديل بيانات الشركة">
        <ActionForm action={updateCompany} submitLabel="حفظ التعديلات" resetOnSuccess={false}>
          <CompanyFields company={company} clients={clients} />
        </ActionForm>
      </Collapsible>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">معاملات الشركة ({transactions.length})</h2>
        <TransactionsTable transactions={transactions} />
      </section>
    </div>
  );
}
