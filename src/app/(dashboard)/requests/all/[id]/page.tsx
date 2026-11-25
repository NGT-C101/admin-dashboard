import Link from "next/link";
import { notFound } from "next/navigation";
import ActionForm from "@/components/ui/ActionForm";
import Collapsible from "@/components/ui/Collapsible";
import { Field } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import StageBadge from "@/components/ui/StageBadge";
import { isOverdue } from "@/components/TransactionsTable";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatSAR, txNumber } from "@/lib/format";
import { addTransactionEvent, updateTransaction } from "../../actions";
import TransactionFields, { loadTxOptions } from "../../fields";

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSection("requests");
  const { id } = await params;
  const tx = await db.transaction.findUnique({
    where: { id },
    include: {
      company: { include: { client: true } },
      stage: true, serviceType: true, govEntity: true,
      assignee: { select: { name: true } },
      createdBy: { select: { name: true } },
      events: { orderBy: { createdAt: "desc" }, include: { stage: true, user: { select: { name: true } } } },
    },
  });
  if (!tx) notFound();

  const [stages, options] = await Promise.all([
    db.stage.findMany({ where: { OR: [{ active: true }, { id: tx.stageId }] }, orderBy: { order: "asc" } }),
    loadTxOptions(db, undefined, tx),
  ]);
  const total = tx.fee || tx.govFees ? Number(tx.fee ?? 0) + Number(tx.govFees ?? 0) : null;

  const info: [string, React.ReactNode][] = [
    ["الشركة", <Link key="c" href={`/clients/companies/${tx.company.id}`} className="link">{tx.company.name}</Link>],
    ["العميل", <Link key="cl" href={`/clients/directory/${tx.company.client.id}`} className="link">{tx.company.client.name}</Link>],
    ["السجل التجاري", tx.company.crNumber],
    ["نوع الخدمة", tx.serviceType?.name],
    ["الجهة الحكومية", tx.govEntity?.name],
    ["رقم الطلب على المنصة", tx.platformRef],
    ["الموظف المسؤول", tx.assignee?.name],
    ["الموعد المستهدف", <span key="d" className={isOverdue(tx) ? "text-rose-600" : ""}>{formatDate(tx.dueDate)}{isOverdue(tx) && " (متأخرة)"}</span>],
    ["أتعاب المكتب", formatSAR(tx.fee)],
    ["الرسوم الحكومية", formatSAR(tx.govFees)],
    ["الإجمالي", formatSAR(total)],
    ["أنشأها", `${tx.createdBy.name} — ${formatDate(tx.createdAt)}`],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tx.title}
        crumbs={[{ label: "المعاملات", href: "/requests/all" }, { label: txNumber(tx.number) }]}
        actions={<StageBadge name={tx.stage.name} kind={tx.stage.kind} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {info.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-neutral-500">{label}</dt>
                  <dd className="font-medium" dir="auto">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            {tx.description && <p className="mt-4 text-sm text-neutral-600 whitespace-pre-line border-t border-neutral-100 pt-4">{tx.description}</p>}
          </div>

          {can(user, "requests", "EDIT") && <Collapsible label="تعديل بيانات المعاملة">
            <ActionForm action={updateTransaction} submitLabel="حفظ التعديلات" resetOnSuccess={false}>
              <TransactionFields tx={tx} options={options} />
            </ActionForm>
          </Collapsible>}
        </div>

        <div className="space-y-6">
          {can(user, "requests", "EDIT") && <div className="card p-5">
            <h2 className="font-semibold mb-3">تحديث المعاملة</h2>
            <ActionForm action={addTransactionEvent} submitLabel="حفظ التحديث">
              <input type="hidden" name="id" value={tx.id} />
              <Field label="المرحلة">
                <select name="stageId" defaultValue={tx.stageId} className="input">
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="ملاحظة">
                <textarea name="note" rows={3} placeholder="مثال: تم رفع الطلب على المنصة وفي انتظار الرد" className="input" />
              </Field>
            </ActionForm>
          </div>}

          <div className="card p-5">
            <h2 className="font-semibold mb-4">سجل المتابعة</h2>
            <ol className="relative border-r-2 border-neutral-200 pr-4 space-y-5">
              {tx.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -right-[23px] top-1.5 w-3 h-3 rounded-full bg-brand-600 ring-4 ring-white" />
                  {e.stage && <StageBadge name={e.stage.name} kind={e.stage.kind} />}
                  {e.note && <p className="text-sm mt-1 whitespace-pre-line">{e.note}</p>}
                  <p className="text-xs text-neutral-500 mt-1">{e.user.name} · {formatDateTime(e.createdAt)}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
