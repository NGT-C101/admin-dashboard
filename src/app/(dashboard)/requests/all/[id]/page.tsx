import Link from "next/link";
import { notFound } from "next/navigation";
import type { TxEventType } from "@prisma/client";
import { Lock, MessageCircle } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import { Field } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import StageBadge from "@/components/ui/StageBadge";
import { isOverdue } from "@/components/TransactionsTable";
import DeliveriesSection, { DELIVERY_INCLUDE } from "@/components/DeliveriesSection";
import DocumentsSection from "@/components/DocumentsSection";
import { AcceptPanel, AcceptanceRecord, ActionsCard, PendingExtension } from "@/components/TxActions";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatSAR, txNumber } from "@/lib/format";
import {
  PRIORITY_LABELS, PRIORITY_STYLES, awaitingAcceptance, canAssign, canSeeTx, externalCommentWhatsapp, isManagerOf,
} from "@/lib/transactions";
import { addTransactionEvent, updateTransaction } from "../../actions";
import TransactionFields, { loadTxOptions } from "../../fields";

// شكل كل نوع حدث في سجل المتابعة
const EVENT_STYLE: Record<TxEventType, { dot: string; label?: string; box?: string }> = {
  NOTE: { dot: "bg-brand-600" },
  ASSIGN: { dot: "bg-violet-500", label: "إسناد" },
  ACCEPT: { dot: "bg-emerald-500", label: "استلام بتعهد" },
  EXTENSION: { dot: "bg-sky-500", label: "تأجيل" },
  WARNING: { dot: "bg-rose-600", label: "لفت نظر", box: "rounded-lg bg-rose-50 p-2 text-rose-800" },
  DELIVERY: { dot: "bg-emerald-600", label: "تسليم" },
};

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSection("requests");
  const { id } = await params;
  const tx = await db.transaction.findUnique({
    where: { id },
    include: {
      company: { include: { client: true } },
      stage: true, serviceType: true, govEntity: true,
      assignee: { select: { name: true, employee: { select: { jobTitle: true } } } },
      createdBy: { select: { name: true } },
      events: { orderBy: { createdAt: "desc" }, include: { stage: true, user: { select: { name: true } } } },
      documents: { orderBy: { createdAt: "asc" }, include: { uploadedBy: { select: { name: true } } } },
      deliveries: { orderBy: { deliveredAt: "desc" }, include: DELIVERY_INCLUDE },
      acceptances: { orderBy: { createdAt: "desc" }, take: 1, include: { user: { select: { name: true } } } },
      extensionRequests: { where: { status: "PENDING" }, include: { requestedBy: { select: { name: true } } } },
    },
  });
  if (!tx || !canSeeTx(user, tx)) notFound();

  const pendingExt = tx.extensionRequests[0];
  const [stages, options, doneStage, canDecideExt, canWarn] = await Promise.all([
    db.stage.findMany({ where: { OR: [{ active: true }, { id: tx.stageId }] }, orderBy: { order: "asc" } }),
    loadTxOptions(db, undefined, tx),
    db.stage.findFirst({ where: { active: true, kind: "DONE" }, orderBy: { order: "asc" }, select: { name: true } }),
    pendingExt ? isManagerOf(db, user, pendingExt.requestedById) : false,
    tx.stage.kind === "OPEN" ? isManagerOf(db, user, tx.assigneeId) : false,
  ]);
  const edit = can(user, "requests", "EDIT");
  const waiting = awaitingAcceptance(tx);
  const isAssignee = tx.assigneeId === user.id;
  const total = tx.fee || tx.govFees ? Number(tx.fee ?? 0) + Number(tx.govFees ?? 0) : null;
  const acceptance = tx.acceptedAt ? tx.acceptances[0] : undefined;

  const info: [string, React.ReactNode][] = [
    ["الشركة", <Link key="c" href={`/clients/companies/${tx.company.id}`} className="link">{tx.company.name}</Link>],
    ["العميل", <Link key="cl" href={`/clients/directory/${tx.company.client.id}`} className="link">{tx.company.client.name}</Link>],
    ["السجل التجاري", tx.company.crNumber],
    ["نوع الخدمة", tx.serviceType?.name],
    ["الجهة الحكومية", tx.govEntity?.name],
    ["رقم الطلب على المنصة", tx.platformRef],
    ["الموظف المسؤول", tx.assignee && <span key="a">{tx.assignee.name}{waiting && <span className="block text-xs text-amber-700">بانتظار الاستلام</span>}</span>],
    ["الموعد المستهدف", <span key="d" className={isOverdue(tx) ? "text-rose-600" : ""}>{formatDate(tx.dueDate)}{isOverdue(tx) && " (متأخرة)"}</span>],
    ["الأولوية", <Badge key="p" className={PRIORITY_STYLES[tx.priority]}>{PRIORITY_LABELS[tx.priority]}</Badge>],
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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {tx.confidential && <Badge className="bg-navy-900 text-gold-300 ring-gold-500/40"><Lock size={12} className="inline" /> سرية</Badge>}
            {tx.priority !== "NORMAL" && <Badge className={PRIORITY_STYLES[tx.priority]}>{PRIORITY_LABELS[tx.priority]}</Badge>}
            <StageBadge name={tx.stage.name} kind={tx.stage.kind} />
          </div>
        }
      />

      {waiting && isAssignee && (
        <AcceptPanel txId={tx.id} txNo={txNumber(tx.number)} userName={user.name} jobTitle={tx.assignee?.employee?.jobTitle} dueDate={tx.dueDate} />
      )}
      {waiting && !isAssignee && (
        <p className="card p-4 text-sm font-semibold text-amber-800">
          بانتظار استلام {tx.assignee?.name} للمعاملة بتعهد. لا يمكن تغيير مرحلتها قبل ذلك.
        </p>
      )}
      {acceptance && <AcceptanceRecord a={acceptance} />}
      {pendingExt && <PendingExtension r={pendingExt} canDecide={canDecideExt} />}

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
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

          {edit && <Collapsible label="تعديل بيانات المعاملة">
            <ActionForm action={updateTransaction} submitLabel="حفظ التعديلات" resetOnSuccess={false}>
              <TransactionFields tx={tx} options={options} canEditDue={can(user, "requests", "MANAGE")} />
            </ActionForm>
          </Collapsible>}

          <DocumentsSection
            ownerType="transaction" ownerId={tx.id} title="المخرجات" documents={tx.documents} userId={user.id}
            canUpload={edit} canManage={can(user, "requests", "MANAGE")}
            deliveredIds={new Set(tx.deliveries.flatMap((d) => d.documents.map((x) => x.id)))}
          />

          <DeliveriesSection
            tx={tx} deliveries={tx.deliveries} outputs={tx.documents} doneStageName={doneStage?.name}
            canEdit={edit} canManage={can(user, "requests", "MANAGE")}
          />
        </div>

        <div className="space-y-6">
          {edit && <div className="card p-5">
            <h2 className="font-semibold mb-3">تحديث المعاملة</h2>
            <ActionForm action={addTransactionEvent} submitLabel="حفظ التحديث">
              <input type="hidden" name="id" value={tx.id} />
              <Field label="المرحلة">
                <select name="stageId" defaultValue={tx.stageId} disabled={waiting} className="input">
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              {waiting && <p className="text-xs text-amber-700">تُفعَّل المرحلة بعد استلام المسؤول للمعاملة.</p>}
              <Field label="تعليق">
                <textarea name="note" rows={3} placeholder="مثال: تم رفع الطلب على المنصة وفي انتظار الرد" className="input" />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="external" className="mt-1 size-4 accent-brand-600" />
                <span>تعليق خارجي موجّه للعميل <span className="block text-xs text-neutral-500">يظهر بشارة خاصة، ويمكن إرساله للعميل على واتساب. التعليق الداخلي لفريق العمل فقط.</span></span>
              </label>
            </ActionForm>
          </div>}

          <ActionsCard
            txId={tx.id} users={options.users} assigneeId={tx.assigneeId} dueDate={tx.dueDate}
            canAssign={tx.stage.kind === "OPEN" && canAssign(user, tx)}
            canRequestExtension={isAssignee && !waiting && tx.stage.kind === "OPEN" && !pendingExt && edit}
            canWarn={canWarn}
          />

          <div className="card p-5">
            <h2 className="font-semibold mb-4">سجل المتابعة</h2>
            <ol className="relative border-r-2 border-neutral-200 pr-4 space-y-5">
              {tx.events.map((e) => {
                const st = EVENT_STYLE[e.type];
                const wa = e.external && e.note ? externalCommentWhatsapp({
                  phone: tx.company.client.phone, clientName: tx.company.client.name, txTitle: tx.title, txNo: txNumber(tx.number), body: e.note,
                }) : null;
                return (
                  <li key={e.id} className="relative">
                    <span className={`absolute -right-[23px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${st.dot}`} />
                    <div className="flex flex-wrap gap-1">
                      {e.stage && <StageBadge name={e.stage.name} kind={e.stage.kind} />}
                      {st.label && <Badge className="bg-neutral-100 text-neutral-700 ring-neutral-200">{st.label}</Badge>}
                      {e.external
                        ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">تعليق خارجي للعميل</Badge>
                        : e.type === "NOTE" && e.note && !e.stage && <Badge className="bg-neutral-50 text-neutral-500 ring-neutral-200">داخلي</Badge>}
                    </div>
                    {e.note && <p className={`text-sm mt-1 whitespace-pre-line ${st.box ?? ""}`}>{e.note}</p>}
                    <p className="text-xs text-neutral-500 mt-1">{e.user.name} · {formatDateTime(e.createdAt)}</p>
                    {wa && <a href={wa} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"><MessageCircle size={13} /> إرسال للعميل على واتساب</a>}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
