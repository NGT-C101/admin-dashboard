import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Building2, CalendarClock, Check, Mail, MapPin, MessageCircle, Phone, Trash2, Users } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import { Field, FieldGrid } from "@/components/ui/Field";
import { createInteraction, deleteInteraction, toggleFollowUp } from "@/app/(dashboard)/clients/interaction-actions";
import type { CurrentUser } from "@/lib/auth";
import { INTERACTION_TYPE_LABELS, endOfToday } from "@/lib/clients";
import { formatDateTime } from "@/lib/format";

export const INTERACTION_INCLUDE = {
  client: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  assignee: { select: { name: true } },
} satisfies Prisma.InteractionInclude;
export type InteractionRow = Prisma.InteractionGetPayload<{ include: typeof INTERACTION_INCLUDE }>;

const ICONS = { CALL: Phone, WHATSAPP: MessageCircle, MEETING: Users, VISIT: MapPin, EMAIL: Mail, OTHER: MessageCircle };

// قيمة datetime-local بتوقيت السيرفر المحلي
function localNow() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function InteractionForm({ clients, clientId, companies, users }: {
  clients?: { id: string; name: string }[];
  clientId?: string;
  companies?: { id: string; name: string }[];
  users: { id: string; name: string }[];
}) {
  return (
    <ActionForm action={createInteraction} submitLabel="تسجيل">
      <FieldGrid>
        {clients ? (
          <Field label="العميل *">
            <select name="clientId" required defaultValue="" className="input">
              <option value="" disabled>اختار العميل</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        ) : <input type="hidden" name="clientId" value={clientId} />}
        {companies && companies.length > 0 && (
          <Field label="الشركة (اختياري)">
            <select name="companyId" defaultValue={companies.length === 1 ? companies[0].id : ""} className="input">
              <option value="">—</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="نوع التواصل">
          <select name="type" defaultValue="CALL" className="input">
            {Object.entries(INTERACTION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="التاريخ والوقت">
          <input name="occurredAt" type="datetime-local" defaultValue={localNow()} className="input" />
        </Field>
        <Field label="الملخص *" wide>
          <textarea name="summary" required rows={2} placeholder="اتكلمنا في إيه؟ اتفقنا على إيه؟" className="input" />
        </Field>
        <Field label="موعد المتابعة (اختياري)">
          <input name="followUpAt" type="datetime-local" className="input" />
        </Field>
        <Field label="مسؤول المتابعة">
          <select name="assigneeId" defaultValue="" className="input">
            <option value="">أنا</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="المطلوب في المتابعة">
          <input name="followUpNote" placeholder="مثال: نكلّمه نأكد استلام العرض" className="input" />
        </Field>
      </FieldGrid>
    </ActionForm>
  );
}

export function InteractionList({ items, user, showClient }: { items: InteractionRow[]; user: CurrentUser; showClient?: boolean }) {
  if (items.length === 0) return <div className="card p-8 text-center text-neutral-500">لسه مفيش تواصل متسجّل</div>;
  const today = endOfToday();
  return (
    <ol className="space-y-3">
      {items.map((it) => {
        const Icon = ICONS[it.type];
        const due = it.followUpAt && !it.followUpDone;
        const late = due && it.followUpAt! < new Date();
        const isToday = due && !late && it.followUpAt! <= today;
        return (
          <li key={it.id} className="card p-4 flex gap-3">
            <div className="w-9 h-9 shrink-0 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center"><Icon size={17} /></div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-semibold">{INTERACTION_TYPE_LABELS[it.type]}</span>
                {showClient && <Link href={`/clients/directory/${it.client.id}`} className="link">{it.client.name}</Link>}
                {it.company && (
                  <Link href={`/clients/companies/${it.company.id}`} className="flex items-center gap-1 text-neutral-600 hover:underline">
                    <Building2 size={13} />{it.company.name}
                  </Link>
                )}
                <span className="text-xs text-neutral-500">{formatDateTime(it.occurredAt)} · {it.createdBy.name}</span>
              </div>
              <p className="text-sm whitespace-pre-line">{it.summary}</p>
              {it.followUpAt && (
                <div className={`mt-2 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                  it.followUpDone ? "bg-neutral-50 text-neutral-500 line-through"
                  : late ? "bg-rose-50 text-rose-700" : isToday ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-800"}`}>
                  <CalendarClock size={14} />
                  <span>متابعة {late ? "متأخرة" : isToday ? "النهارده" : ""}: {formatDateTime(it.followUpAt)}</span>
                  {it.assignee && <span>· {it.assignee.name}</span>}
                  {it.followUpNote && <span>· {it.followUpNote}</span>}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 items-end">
              {it.followUpAt && (
                <form action={toggleFollowUp}>
                  <input type="hidden" name="id" value={it.id} />
                  <button className={`flex items-center gap-1 text-xs rounded-lg px-2 py-1 ${it.followUpDone ? "text-neutral-500 hover:bg-neutral-100" : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"}`}>
                    <Check size={14} /> {it.followUpDone ? "رجّعها" : "تمت المتابعة"}
                  </button>
                </form>
              )}
              {(user.role !== "EMPLOYEE" || it.createdById === user.id) && (
                <form action={deleteInteraction}>
                  <input type="hidden" name="id" value={it.id} />
                  <button className="text-rose-600 text-xs flex items-center gap-1 hover:underline"><Trash2 size={13} /> حذف</button>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
