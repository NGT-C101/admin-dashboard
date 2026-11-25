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
import { createCompany, updateClient } from "../../actions";
import { ClientFields, CompanyFields } from "../../fields";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection("clients");
  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    include: { companies: { orderBy: { createdAt: "asc" }, include: { _count: { select: { transactions: true } } } } },
  });
  if (!client) notFound();

  const transactions = await db.transaction.findMany({
    where: { company: { clientId: id } },
    include: TX_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  const info = [
    ["رقم الهوية / الإقامة", client.nationalId],
    ["الجوال", client.phone],
    ["البريد", client.email],
    ["الجنسية", client.nationality],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        crumbs={[{ label: "العملاء", href: "/clients/directory" }, { label: client.name }]}
        actions={
          <Link href={`/requests/all/new?clientId=${client.id}`} className="btn-primary">
            <Plus size={16} /> معاملة جديدة
          </Link>
        }
      />

      <div className="card p-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {info.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="font-medium" dir="auto">{value || "—"}</dd>
            </div>
          ))}
        </dl>
        {client.notes && <p className="mt-4 text-sm text-slate-600 whitespace-pre-line">{client.notes}</p>}
      </div>

      <Collapsible label="تعديل بيانات العميل">
        <ActionForm action={updateClient} submitLabel="حفظ التعديلات" resetOnSuccess={false}>
          <ClientFields client={client} />
        </ActionForm>
      </Collapsible>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">الشركات ({client.companies.length})</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>الشركة</th><th>السجل التجاري</th><th>الرقم الموحد</th><th>المدينة</th><th>انتهاء السجل</th><th>المعاملات</th></tr>
            </thead>
            <tbody>
              {client.companies.map((co) => (
                <tr key={co.id}>
                  <td><Link href={`/clients/companies/${co.id}`} className="link">{co.name}</Link></td>
                  <td dir="ltr" className="text-right">{co.crNumber ?? "—"}</td>
                  <td dir="ltr" className="text-right">{co.unifiedNumber ?? "—"}</td>
                  <td>{co.city ?? "—"}</td>
                  <td>{formatDate(co.crExpiry)}</td>
                  <td>{co._count.transactions}</td>
                </tr>
              ))}
              {client.companies.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-500 py-8">لسه مفيش شركات للعميل ده</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Collapsible label="إضافة شركة للعميل">
          <ActionForm action={createCompany} submitLabel="حفظ الشركة">
            <CompanyFields clientId={client.id} />
          </ActionForm>
        </Collapsible>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">كل معاملات العميل ({transactions.length})</h2>
        <TransactionsTable transactions={transactions} showCompany />
      </section>
    </div>
  );
}
