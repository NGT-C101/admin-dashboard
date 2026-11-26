import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { MessageCircle, Printer, Trash2 } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import DateField from "@/components/ui/DateField";
import { Field, FieldGrid } from "@/components/ui/Field";
import { deleteDelivery, recordDelivery } from "@/app/(dashboard)/requests/delivery-actions";
import { DOC_TYPE_LABELS } from "@/lib/documents";
import { CHANNEL_LABELS, CHANNEL_STYLES, deliveryNumber, deliveryWhatsapp, itemLines } from "@/lib/deliveries";
import { formatDateTime } from "@/lib/format";
import { dateKey, riyadhHM, riyadhToday } from "@/lib/time";

export const DELIVERY_INCLUDE = {
  documents: { select: { id: true, type: true, title: true, fileName: true } },
  deliveredBy: { select: { name: true } },
} satisfies Prisma.DeliveryInclude;
type DeliveryRow = Prisma.DeliveryGetPayload<{ include: typeof DELIVERY_INCLUDE }>;

type Tx = {
  id: string; number: number; title: string;
  stage: { kind: "OPEN" | "DONE" | "CANCELLED"; readyForDelivery: boolean };
  company: { name: string; client: { name: string; phone: string | null } };
};

export default function DeliveriesSection({ tx, deliveries, outputs, canEdit, canManage, doneStageName }: {
  tx: Tx;
  doneStageName?: string; // أول مرحلة مكتملة: تُنقل إليها المعاملة عند التسليم
  deliveries: DeliveryRow[];
  outputs: { id: string; type: keyof typeof DOC_TYPE_LABELS; title: string | null; fileName: string }[];
  canEdit: boolean;
  canManage: boolean;
}) {
  const delivered = new Set(deliveries.flatMap((d) => d.documents.map((x) => x.id)));
  const now = new Date();
  const nowValue = `${dateKey(riyadhToday(now))}T${riyadhHM(now)}`;

  return (
    <section id="delivery" className="space-y-3 scroll-mt-6">
      <h2 className="text-lg font-semibold">
        سجل التسليم <span className="text-sm font-normal text-neutral-500">({deliveries.length})</span>
      </h2>

      {deliveries.length === 0 && (
        <p className={`card p-4 text-sm ${tx.stage.readyForDelivery ? "font-semibold text-amber-800" : "text-neutral-500"}`}>
          {tx.stage.readyForDelivery ? "المخرجات جاهزة ولم تُسلَّم للعميل بعد." : "لم يُسجَّل أي تسليم لهذه المعاملة."}
        </p>
      )}

      {deliveries.map((d) => {
        const wa = deliveryWhatsapp({
          phone: d.recipientPhone ?? tx.company.client.phone, clientName: tx.company.client.name, companyName: tx.company.name,
          txTitle: tx.title, txNo: tx.number, note: d.note, documents: d.documents, items: d.items,
        });
        const items = itemLines(d.items);
        return (
          <article key={d.id} className="card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <b dir="ltr">{deliveryNumber(d.number)}</b>
                <Badge className={CHANNEL_STYLES[d.channel]}>{CHANNEL_LABELS[d.channel]}</Badge>
                <span className="text-sm text-neutral-600">{formatDateTime(d.deliveredAt)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Link href={`/requests/deliverables/${d.id}/receipt`} className="link flex items-center gap-1"><Printer size={14} /> إيصال التسليم</Link>
                {wa && <a href={wa} target="_blank" rel="noopener" className="flex items-center gap-1 text-emerald-700 hover:underline"><MessageCircle size={14} /> إرسال على واتساب</a>}
                {canManage && (
                  <form action={deleteDelivery}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="flex items-center gap-1 text-rose-600 hover:underline"><Trash2 size={14} /> حذف السجل</button>
                  </form>
                )}
              </div>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-neutral-500">المستلم</dt><dd className="font-medium">{d.recipientName}</dd></div>
              <div><dt className="text-xs text-neutral-500">هوية المستلم</dt><dd dir="ltr" className="text-right">{d.recipientIdNo ?? "—"}</dd></div>
              <div><dt className="text-xs text-neutral-500">سلّمها</dt><dd>{d.deliveredBy.name}</dd></div>
            </dl>
            <ul className="list-disc space-y-0.5 pr-5 text-sm">
              {d.documents.map((x) => (
                <li key={x.id}>
                  <a href={`/api/files/${x.id}`} target="_blank" rel="noopener" className="link">{DOC_TYPE_LABELS[x.type]}{x.title ? `: ${x.title}` : ""}</a>
                </li>
              ))}
              {items.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
            {d.note && <p className="whitespace-pre-line rounded-lg bg-neutral-50 p-3 text-sm"><span className="text-neutral-500">رسالة للعميل: </span>{d.note}</p>}
          </article>
        );
      })}

      {canEdit && (
        <Collapsible label="تسجيل تسليم للعميل" defaultOpen={tx.stage.readyForDelivery && deliveries.length === 0}>
          <ActionForm action={recordDelivery} submitLabel="حفظ التسليم">
            <input type="hidden" name="transactionId" value={tx.id} />
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">المخرجات المسلَّمة</legend>
              {outputs.length === 0 && <p className="text-sm text-neutral-500">لا توجد مخرجات مرفوعة. ارفعها من «المخرجات» أعلاه، أو اكتب البنود الورقية في الخانة التالية.</p>}
              {outputs.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="documentIds" value={o.id} defaultChecked={!delivered.has(o.id)} className="size-4 accent-brand-600" />
                  <span>{DOC_TYPE_LABELS[o.type]}{o.title ? `: ${o.title}` : ""}</span>
                  {delivered.has(o.id) && <span className="text-xs text-neutral-500">(سُلِّم سابقاً)</span>}
                </label>
              ))}
            </fieldset>
            <FieldGrid>
              <Field label="أصول ومستندات ورقية مسلَّمة (بند في كل سطر)" wide>
                <textarea name="items" rows={3} placeholder={"مثال:\nأصل السجل التجاري\nختم الشركة"} className="input" />
              </Field>
              <Field label="تاريخ ووقت التسليم *">
                <DateField name="deliveredAt" withTime defaultValue={nowValue} required />
              </Field>
              <Field label="طريقة التسليم *">
                <select name="channel" required defaultValue="HAND" className="input">
                  {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="اسم المستلم *">
                <input name="recipientName" required defaultValue={tx.company.client.name} className="input" />
              </Field>
              <Field label="هوية المستلم (اختياري)">
                <input name="recipientIdNo" inputMode="numeric" maxLength={10} dir="ltr" className="input" />
              </Field>
              <Field label="جوال المستلم (لرسالة واتساب)">
                <input name="recipientPhone" inputMode="tel" dir="ltr" defaultValue={tx.company.client.phone ?? ""} className="input" />
              </Field>
              <Field label="رسالة للعميل (اختياري — تُضاف إلى رسالة واتساب)" wide>
                <textarea name="note" rows={2} placeholder="مثال: نأمل مراجعة السجل الجديد والتأكد من صحة البيانات" className="input" />
              </Field>
            </FieldGrid>
            {doneStageName && tx.stage.kind !== "DONE" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="complete" defaultChecked className="size-4 accent-brand-600" />
                نقل المعاملة إلى مرحلة «{doneStageName}» (اترك الخيار فارغاً إذا كان التسليم جزئياً)
              </label>
            )}
          </ActionForm>
        </Collapsible>
      )}
    </section>
  );
}
