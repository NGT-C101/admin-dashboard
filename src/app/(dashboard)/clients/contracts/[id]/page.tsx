import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, RefreshCw, RotateCcw } from "lucide-react";
import { contractNumber } from "@/components/ContractsTable";
import DocumentsSection from "@/components/DocumentsSection";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import { can, requireSection } from "@/lib/auth";
import { CONTRACT_STATE_LABELS, CONTRACT_STATE_STYLES, CONTRACT_TYPE_LABELS, contractState, daysText, daysUntil } from "@/lib/clients";
import { db } from "@/lib/db";
import { formatDate, formatSAR } from "@/lib/format";
import { renewContract, toggleCancelContract, updateContract } from "../../contract-actions";
import ContractFields, { loadContractClients } from "../fields";

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSection("clients");
  const { id } = await params;
  const c = await db.contract.findUnique({
    where: { id },
    include: {
      client: true, company: true, createdBy: { select: { name: true } },
      documents: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
    },
  });
  if (!c) notFound();
  const clients = await loadContractClients(db, c.clientId);
  const st = contractState(c);
  const left = c.endDate ? daysUntil(c.endDate) : null;

  const info: [string, React.ReactNode][] = [
    ["العميل", <Link key="c" href={`/clients/directory/${c.client.id}`} className="link">{c.client.name}</Link>],
    ["الشركة", c.company ? <Link key="co" href={`/clients/companies/${c.company.id}`} className="link">{c.company.name}</Link> : "جميع شركات العميل"],
    ["النوع", CONTRACT_TYPE_LABELS[c.type] + (c.autoRenew ? " · تجديد تلقائي" : "")],
    ["القيمة", formatSAR(c.value) + (c.type === "MONTHLY" && c.value ? " / شهر" : "")],
    ["البداية", formatDate(c.startDate)],
    ["النهاية", c.endDate ? `${formatDate(c.endDate)}${left !== null && left >= 0 && !c.cancelledAt ? ` (متبقٍ ${daysText(left)})` : ""}` : "مفتوح"],
    ["أنشأه", `${c.createdBy.name} — ${formatDate(c.createdAt)}`],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.title}
        crumbs={[{ label: "العقود والاتفاقيات", href: "/clients/contracts" }, { label: contractNumber(c.number) }]}
        actions={<Badge className={CONTRACT_STATE_STYLES[st]}>{CONTRACT_STATE_LABELS[st]}</Badge>}
      />
      <div className="card p-5 space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {info.map(([l, v]) => <div key={l}><dt className="text-xs text-neutral-500">{l}</dt><dd className="font-medium">{v}</dd></div>)}
        </dl>
        {c.terms && <p className="text-sm text-neutral-700 whitespace-pre-line border-t border-neutral-100 pt-4">{c.terms}</p>}
        {can(user, "clients", "MANAGE") && (
          <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
            {c.endDate && !c.cancelledAt && (
              <form action={renewContract}>
                <input type="hidden" name="id" value={c.id} />
                <button className="btn-secondary"><RefreshCw size={15} /> تجديد {c.type === "MONTHLY" ? "شهر" : "سنة"}</button>
              </form>
            )}
            <form action={toggleCancelContract}>
              <input type="hidden" name="id" value={c.id} />
              <button className="btn-secondary">{c.cancelledAt ? <><RotateCcw size={15} /> إعادة تفعيل</> : <><Ban size={15} /> إلغاء العقد</>}</button>
            </form>
          </div>
        )}
      </div>
      {can(user, "clients", "EDIT") && <Collapsible label="تعديل العقد">
        <ActionForm action={updateContract} submitLabel="حفظ التعديلات" resetOnSuccess={false}>
          <ContractFields contract={c} clients={clients} />
        </ActionForm>
      </Collapsible>}
      <DocumentsSection ownerType="contract" ownerId={c.id} documents={c.documents} userId={user.id} canUpload={can(user, "clients", "EDIT")} canManage={can(user, "clients", "MANAGE")} />
    </div>
  );
}
