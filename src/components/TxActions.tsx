import type { ExtensionRequest, TxAcceptance } from "@prisma/client";
import { AlertTriangle, CalendarClock, ShieldCheck, UserRoundCog } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import DateField from "@/components/ui/DateField";
import { Field } from "@/components/ui/Field";
import {
  acceptTransaction, assignTransaction, decideExtension, requestExtension, warnAssignee,
} from "@/app/(dashboard)/requests/tx-actions";
import { dateInputValue, formatDate, formatDateTime } from "@/lib/format";

// نموذج الاستلام بتعهد — يظهر للموظف المسؤول قبل بدء العمل
export function AcceptPanel({ txId, txNo, userName, jobTitle, dueDate }: {
  txId: string; txNo: string; userName: string; jobTitle?: string | null; dueDate?: Date | null;
}) {
  return (
    <div className="card border-2 border-amber-300 p-5 space-y-3">
      <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-amber-600" /> استلام المعاملة بتعهد</h2>
      <p className="text-sm text-neutral-600">
        هذه المعاملة مسندة إليك. يرجى استلامها بالإقرار التالي قبل البدء، ولن يمكن تغيير مرحلتها قبل ذلك.
      </p>
      <ActionForm action={acceptTransaction} submitLabel="استلام المعاملة">
        <input type="hidden" name="id" value={txId} />
        <p className="rounded-lg bg-neutral-50 p-3 text-sm leading-relaxed">
          أقرّ أنا <b>{userName}</b> بأنني استلمت المعاملة رقم <b dir="ltr">{txNo}</b> وكافة مستنداتها، وأتعهد بإنهائها في الموعد المحدد أدناه أو طلب تأجيله مسبقاً.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="صفتك الوظيفية">
            <input name="jobTitle" defaultValue={jobTitle ?? ""} placeholder="مثال: أخصائي معاملات حكومية" className="input" />
          </Field>
          <Field label="أتعهد بإنهاء المعاملة في موعد أقصاه *">
            <DateField name="committedDue" defaultValue={dateInputValue(dueDate)} required />
          </Field>
        </div>
        <Field label="المستندات والأصول المستلمة من العميل (اختياري)">
          <textarea name="documents" rows={2} placeholder="مثال: صورة الهوية، أصل السجل التجاري" className="input" />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="pledgeSecrecy" required className="mt-1 size-4 accent-brand-600" />
          أتعهد بالحفاظ على سرية مستندات العميل وبياناته وسلامتها، وعدم إطلاع غير المختصين عليها.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="pledgeEffort" required className="mt-1 size-4 accent-brand-600" />
          أتعهد ببذل أقصى جهد لإنهاء إجراءات المعاملة وإبلاغ العميل بما يُطلب منه في حينه.
        </label>
      </ActionForm>
    </div>
  );
}

// سجل الاستلام الثابت أعلى المعاملة
export function AcceptanceRecord({ a }: { a: TxAcceptance & { user: { name: string } } }) {
  return (
    <details className="card border-r-4 border-emerald-500 p-4 text-sm">
      <summary className="cursor-pointer select-none">
        <span className="font-semibold text-emerald-700">تم استلام المعاملة بتعهد</span> من قِبل {a.user.name}
        {a.jobTitle && ` (${a.jobTitle})`} في {formatDateTime(a.createdAt)}، وموعد الإنجاز المتعهَّد به {formatDate(a.committedDue)}.
      </summary>
      <p className="mt-3 whitespace-pre-line rounded-lg bg-neutral-50 p-3 leading-relaxed">{a.pledgeText}</p>
      {a.documents && <p className="mt-2"><span className="text-neutral-500">المستندات المستلمة: </span>{a.documents}</p>}
    </details>
  );
}

type Ext = ExtensionRequest & { requestedBy: { name: string } };

// طلب تأجيل بانتظار القرار
export function PendingExtension({ r, canDecide }: { r: Ext; canDecide: boolean }) {
  return (
    <div className="card border-2 border-sky-200 p-4 space-y-3 text-sm">
      <p className="flex items-center gap-2 font-semibold"><CalendarClock size={16} className="text-sky-600" /> طلب تأجيل بانتظار القرار</p>
      <p>
        طلب {r.requestedBy.name} تأجيل الموعد{r.currentDue && ` من ${formatDate(r.currentDue)}`} إلى <b>{formatDate(r.requestedDue)}</b>
        <span className="text-neutral-500"> — {formatDateTime(r.createdAt)}</span>
      </p>
      <p className="whitespace-pre-line rounded-lg bg-neutral-50 p-3"><span className="text-neutral-500">السبب: </span>{r.reason}</p>
      {canDecide ? (
        <ActionForm action={decideExtension} submitLabel="حفظ القرار" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={r.id} />
          <select name="decision" defaultValue="APPROVED" className="input w-auto">
            <option value="APPROVED">موافقة</option>
            <option value="REJECTED">رفض</option>
          </select>
          <input name="decisionNote" placeholder="ملاحظة (اختياري)" className="input min-w-48 flex-1" />
        </ActionForm>
      ) : (
        <p className="text-xs text-neutral-500">يبت فيه المدير المباشر للموظف أو صاحب صلاحية الإدارة الكاملة على المعاملات.</p>
      )}
    </div>
  );
}

// الإسناد، طلب التأجيل، لفت النظر
export function ActionsCard({ txId, users, assigneeId, canAssign, canRequestExtension, canWarn, dueDate }: {
  txId: string;
  users: { id: string; name: string }[];
  assigneeId: string | null;
  canAssign: boolean;
  canRequestExtension: boolean;
  canWarn: boolean;
  dueDate: Date | null;
}) {
  if (!canAssign && !canRequestExtension && !canWarn) return null;
  return (
    <div className="card divide-y divide-neutral-100">
      <h2 className="p-4 font-semibold">إجراءات المعاملة</h2>
      {canAssign && (
        <details className="p-4">
          <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium"><UserRoundCog size={16} /> إسناد إلى موظف</summary>
          <ActionForm action={assignTransaction} submitLabel="إسناد" className="mt-3 space-y-3">
            <input type="hidden" name="id" value={txId} />
            <select name="assigneeId" required defaultValue="" className="input">
              <option value="" disabled>اختر الموظف</option>
              {users.filter((u) => u.id !== assigneeId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <textarea name="note" rows={2} placeholder="ملاحظة للموظف (اختياري)" className="input" />
            <p className="text-xs text-neutral-500">يجب على الموظف الجديد استلام المعاملة بتعهد قبل متابعتها.</p>
          </ActionForm>
        </details>
      )}
      {canRequestExtension && (
        <details className="p-4">
          <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium"><CalendarClock size={16} /> طلب تأجيل موعد الإنجاز</summary>
          <ActionForm action={requestExtension} submitLabel="إرسال الطلب" className="mt-3 space-y-3">
            <input type="hidden" name="id" value={txId} />
            {dueDate && <p className="text-sm text-neutral-600">الموعد الحالي: {formatDate(dueDate)}</p>}
            <Field label="الموعد الجديد المطلوب *"><DateField name="requestedDue" required /></Field>
            <textarea name="reason" rows={2} required placeholder="سبب التأجيل (مثال: تأخر رد الجهة الحكومية)" className="input" />
          </ActionForm>
        </details>
      )}
      {canWarn && (
        <details className="p-4">
          <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-rose-700"><AlertTriangle size={16} /> لفت نظر للموظف المسؤول</summary>
          <ActionForm action={warnAssignee} submitLabel="تسجيل لفت النظر" className="mt-3 space-y-3">
            <input type="hidden" name="id" value={txId} />
            <textarea name="note" rows={2} required placeholder="مثال: تأخر تحديث المعاملة دون إبلاغ" className="input" />
            <p className="text-xs text-neutral-500">يُسجَّل لفت النظر في سجل المعاملة ويظهر للموظف.</p>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
