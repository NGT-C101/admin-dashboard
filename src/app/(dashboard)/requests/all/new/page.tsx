import Link from "next/link";
import ActionForm from "@/components/ui/ActionForm";
import PageHeader from "@/components/ui/PageHeader";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { createTransaction } from "../../actions";
import TransactionFields, { loadTxOptions } from "../../fields";

export default async function NewTransactionPage({
  searchParams,
}: { searchParams: Promise<{ companyId?: string; clientId?: string }> }) {
  await requireSection("requests");
  const { companyId, clientId } = await searchParams;
  const options = await loadTxOptions(db, clientId);

  return (
    <div className="space-y-6">
      <PageHeader title="معاملة جديدة" crumbs={[{ label: "المعاملات", href: "/requests/all" }, { label: "جديدة" }]} />
      <div className="card p-5">
        {options.companies.length === 0 ? (
          <p className="text-sm text-slate-600">
            لازم يكون فيه شركة مسجّلة الأول. روح لـ <Link href="/clients/directory" className="link">العملاء</Link> وضيف العميل وشركته.
          </p>
        ) : (
          <ActionForm action={createTransaction} submitLabel="إنشاء المعاملة">
            <TransactionFields options={options} companyId={companyId} />
          </ActionForm>
        )}
      </div>
    </div>
  );
}
