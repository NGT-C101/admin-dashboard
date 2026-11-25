import ActionForm from "@/components/ui/ActionForm";
import PageHeader from "@/components/ui/PageHeader";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { createContract } from "../../contract-actions";
import ContractFields, { loadContractClients } from "../fields";

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ clientId?: string; companyId?: string }> }) {
  await requireSection("clients");
  const { clientId, companyId } = await searchParams;
  const clients = await loadContractClients(db);
  return (
    <div className="space-y-6">
      <PageHeader title="عقد جديد" crumbs={[{ label: "العقود والاتفاقيات", href: "/clients/contracts" }, { label: "جديد" }]} />
      <div className="card p-5">
        <ActionForm action={createContract} submitLabel="حفظ العقد">
          <ContractFields clients={clients} clientId={clientId} companyId={companyId} />
        </ActionForm>
      </div>
    </div>
  );
}
