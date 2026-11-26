import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Printer } from "lucide-react";
import DocumentsSection from "@/components/DocumentsSection";
import LetterFields from "@/components/LetterForm";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatHijri } from "@/lib/format";
import { SECTION, STATUS_LABELS, STATUS_STYLES, canApprove, canEditLetter, canReview, letterNumber } from "@/lib/letters";
import { approveLetter, cancelLetter, reviewLetter, saveOutgoing, submitLetter, updateIncoming } from "../actions";

function Decision({ action, id, okLabel }: { action: typeof reviewLetter; id: string; okLabel: string }) {
  return (
    <ActionForm action={action} submitLabel="حفظ القرار" className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <select name="decision" defaultValue="OK" className="input">
        <option value="OK">{okLabel}</option>
        <option value="RETURN">إعادة للتعديل</option>
      </select>
      <textarea name="note" rows={2} placeholder="ملاحظة (مطلوبة عند الإعادة للتعديل)" className="input" />
    </ActionForm>
  );
}

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSection(SECTION);
  const { id } = await params;
  const l = await db.letter.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { name: true } }, reviewedBy: { select: { name: true } }, approvedBy: { select: { name: true } },
      assignee: { select: { id: true, name: true } },
      documents: { orderBy: { createdAt: "asc" }, include: { uploadedBy: { select: { name: true } } } },
      events: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!l) notFound();

  const out = l.direction === "OUTGOING";
  const edit = can(user, SECTION, "EDIT");
  const manage = can(user, SECTION, "MANAGE");
  const [mayReview, clients, templates, users] = await Promise.all([
    canReview(db, user, l),
    canEditLetter(user, l) ? db.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    canEditLetter(user, l) ? db.letterTemplate.findMany({ where: { active: true }, select: { id: true, name: true, subject: true, body: true } }) : [],
    !out && edit ? db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  const num = letterNumber(l);
  const mayCancel = l.status !== "CANCELLED" && (l.status === "APPROVED" || l.status === "RECEIVED" ? manage : manage || l.createdById === user.id);
  const date = out ? l.letterDate : l.receivedAt;

  const info: [string, React.ReactNode][] = [
    ["رقم " + (out ? "الصادر" : "الوارد"), num ? <bdi>{num}</bdi> : "يُمنح عند الاعتماد"],
    [out ? "التاريخ" : "تاريخ الاستلام", date ? `${formatDate(date)} — ${formatHijri(date)}` : "—"],
    [out ? "إلى" : "من", l.party],
    [out ? "رقم مرجعي" : "رقم خطابهم", l.partyRef],
    ...(!out ? [["تاريخ خطابهم", formatDate(l.letterDate)] as [string, React.ReactNode]] : []),
    ["العميل", l.client && <Link key="c" href={`/clients/directory/${l.client.id}`} className="link">{l.client.name}</Link>],
    [out ? "الكاتب" : "سجّله", l.createdBy.name],
    ...(out ? [
      ["المراجعة", l.reviewedBy ? `${l.reviewedBy.name} — ${formatDateTime(l.reviewedAt!)}` : "—"] as [string, React.ReactNode],
      ["الاعتماد", l.approvedBy ? `${l.approvedBy.name} — ${formatDateTime(l.approvedAt!)}` : "—"] as [string, React.ReactNode],
    ] : [
      ["المحال إليه", l.assignee ? `${l.assignee.name} — ${l.actionDone ? "تم الإجراء" : "لم يُنجز بعد"}` : "—"] as [string, React.ReactNode],
    ]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={l.subject}
        crumbs={[{ label: "الصادر والوارد", href: `/admin-affairs/correspondence${out ? "" : "?tab=in"}` }, { label: num ?? STATUS_LABELS[l.status] }]}
        actions={<Badge className={STATUS_STYLES[l.status]}>{STATUS_LABELS[l.status]}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {info.map(([label, value]) => (
                <div key={label}><dt className="text-xs text-neutral-500">{label}</dt><dd className="font-medium" dir="auto">{value || "—"}</dd></div>
              ))}
            </dl>
            {l.body && <p className="mt-4 whitespace-pre-line border-t border-neutral-100 pt-4 text-sm leading-loose">{l.body}</p>}
          </div>

          {canEditLetter(user, l) && (
            <Collapsible label="تعديل الخطاب" defaultOpen={l.status === "RETURNED"}>
              <ActionForm action={saveOutgoing} submitLabel="حفظ التعديلات" resetOnSuccess={false}>
                <input type="hidden" name="id" value={l.id} />
                <LetterFields templates={templates} clients={clients} letter={l} />
              </ActionForm>
            </Collapsible>
          )}

          <DocumentsSection
            ownerType="letter" ownerId={l.id} title={out ? "مرفقات الخطاب" : "صورة الخطاب ومرفقاته"} documents={l.documents} userId={user.id}
            canUpload={edit && l.status !== "CANCELLED"} canManage={manage}
          />
        </div>

        <div className="space-y-6">
          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">الإجراءات</h2>
            {out && (
              <Link href={`/admin-affairs/correspondence/${l.id}/print`} className="btn-secondary w-full justify-center">
                <Printer size={16} /> {l.status === "APPROVED" ? "طباعة الخطاب / PDF" : "معاينة الخطاب"}
              </Link>
            )}
            {l.verifyToken && (
              <a href={`/verify/${l.verifyToken}`} target="_blank" rel="noopener" className="link flex items-center gap-1 text-sm">
                <ExternalLink size={14} /> صفحة التحقق العامة (رمز QR)
              </a>
            )}
            {canEditLetter(user, l) && (
              <ActionForm action={submitLetter} submitLabel="إرسال للمراجعة">
                <input type="hidden" name="id" value={l.id} />
                <p className="text-sm text-neutral-600">بعد الإرسال يراجعه مديرك المباشر أو المسؤول عن الشؤون الإدارية، ثم يُعتمد.</p>
              </ActionForm>
            )}
            {l.status === "IN_REVIEW" && (mayReview
              ? <><p className="text-sm font-medium">مراجعة الخطاب (التصديق)</p><Decision action={reviewLetter} id={l.id} okLabel="تصديق وإحالة للاعتماد" /></>
              : <p className="text-sm text-amber-700">بانتظار مراجعة المدير المباشر للكاتب أو المسؤول عن الشؤون الإدارية.</p>)}
            {l.status === "REVIEWED" && (canApprove(user, l)
              ? <><p className="text-sm font-medium">اعتماد الخطاب</p><Decision action={approveLetter} id={l.id} okLabel="اعتماد ومنح رقم صادر" /></>
              : <p className="text-sm text-sky-700">بانتظار اعتماد المسؤول عن الشؤون الإدارية.</p>)}
            {!out && edit && l.status === "RECEIVED" && (
              <>
                <ActionForm action={updateIncoming} submitLabel="إحالة" className="space-y-2">
                  <input type="hidden" name="id" value={l.id} />
                  <select name="assigneeId" required defaultValue="" className="input">
                    <option value="" disabled>إحالة إلى موظف</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <input name="note" placeholder="توجيه (اختياري)" className="input" />
                </ActionForm>
                {l.assignee && !l.actionDone && (l.assignee.id === user.id || manage) && (
                  <ActionForm action={updateIncoming} submitLabel="تم الإجراء" className="space-y-2">
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="op" value="done" />
                    <input name="note" placeholder="ما الذي تم؟ (اختياري)" className="input" />
                  </ActionForm>
                )}
              </>
            )}
            {mayCancel && (
              <details className="border-t border-neutral-100 pt-3">
                <summary className="cursor-pointer select-none text-sm text-rose-700">إلغاء الخطاب</summary>
                <ActionForm action={cancelLetter} submitLabel="تأكيد الإلغاء" className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={l.id} />
                  <input name="reason" required placeholder="سبب الإلغاء" className="input" />
                  {l.status === "APPROVED" && <p className="text-xs text-rose-700">ستُظهر صفحة التحقق أن الخطاب ملغى.</p>}
                </ActionForm>
              </details>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-4 font-semibold">سجل الخطاب</h2>
            <ol className="relative space-y-5 border-r-2 border-neutral-200 pr-4">
              {l.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -right-[23px] top-1.5 h-3 w-3 rounded-full bg-brand-600 ring-4 ring-white" />
                  <p className="whitespace-pre-line text-sm">{e.note}</p>
                  <p className="mt-1 text-xs text-neutral-500">{e.user.name} · {formatDateTime(e.createdAt)}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
