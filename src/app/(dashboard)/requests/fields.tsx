import DateField from "@/components/ui/DateField";
import type { Transaction } from "@prisma/client";
import ServicePicker from "@/components/ServicePicker";
import { Field, FieldGrid } from "@/components/ui/Field";
import { dateInputValue } from "@/lib/format";
import { PRIORITY_LABELS } from "@/lib/transactions";

type Opt = { id: string; name: string };
export type TxFormOptions = {
  companies: { id: string; name: string; client: { name: string } }[];
  serviceTypes: (Opt & { govEntityId: string | null })[];
  govEntities: Opt[];
  users: Opt[];
};

export default function TransactionFields({ tx, options, companyId, canEditDue = true }: {
  tx?: Transaction; options: TxFormOptions; companyId?: string;
  canEditDue?: boolean; // بعد الإنشاء يتغيّر الموعد بطلب تأجيل، إلا لصاحب الإدارة الكاملة
}) {
  // الشركات متجمّعة تحت اسم العميل
  const byClient = new Map<string, Opt[]>();
  for (const c of options.companies) {
    byClient.set(c.client.name, [...(byClient.get(c.client.name) ?? []), c]);
  }

  return (
    <FieldGrid>
      {tx && <input type="hidden" name="id" value={tx.id} />}
      <Field label="الشركة *">
        <select name="companyId" required defaultValue={tx?.companyId ?? companyId ?? ""} className="input">
          <option value="" disabled>اختر الشركة</option>
          {[...byClient].map(([client, cos]) => (
            <optgroup key={client} label={client}>
              {cos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="عنوان المعاملة *">
        <input name="title" required placeholder="مثال: إصدار ترخيص صناعي لمصنع الرياض" defaultValue={tx?.title} className="input" />
      </Field>
      <ServicePicker
        entities={options.govEntities}
        services={options.serviceTypes}
        defaultEntityId={tx?.govEntityId}
        defaultServiceId={tx?.serviceTypeId}
      />
      {!tx && (
        <Field label="الموظف المسؤول">
          <select name="assigneeId" defaultValue="auto" className="input">
            <option value="auto">توزيع تلقائي (الأقل انشغالاً)</option>
            <option value="">بدون مسؤول الآن</option>
            {options.users.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="الأولوية">
        <select name="priority" defaultValue={tx?.priority ?? "NORMAL"} className="input">
          {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="رقم الطلب على المنصة">
        <input name="platformRef" dir="ltr" defaultValue={tx?.platformRef ?? ""} className="input" />
      </Field>
      <Field label="أتعاب المكتب (ريال)">
        <input name="fee" inputMode="decimal" dir="ltr" defaultValue={tx?.fee?.toString() ?? ""} className="input" />
      </Field>
      <Field label="الرسوم الحكومية (ريال)">
        <input name="govFees" inputMode="decimal" dir="ltr" defaultValue={tx?.govFees?.toString() ?? ""} className="input" />
      </Field>
      {canEditDue && (
        <Field label={tx ? "الموعد المستهدف للإنجاز" : "الموعد المستهدف (اختياري — يحدده المسؤول عند الاستلام)"}>
          <DateField name="dueDate" defaultValue={dateInputValue(tx?.dueDate)} />
        </Field>
      )}
      <Field label="التفاصيل" wide>
        <textarea name="description" rows={3} defaultValue={tx?.description ?? ""} className="input" />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
        <input type="checkbox" name="confidential" defaultChecked={tx?.confidential} className="size-4 accent-brand-600" />
        معاملة سرية (لا يطّلع عليها إلا الموظف المسؤول عنها ومدير النظام)
      </label>
    </FieldGrid>
  );
}

// current = المعاملة اللي بتتعدّل: نضمن إن خدمتها وجهتها يظهروا حتى لو اتوقفوا
export async function loadTxOptions(
  db: typeof import("@/lib/db").db,
  clientId?: string,
  current?: { serviceTypeId: string | null; govEntityId: string | null; companyId?: string },
): Promise<TxFormOptions> {
  const [companies, serviceTypes, govEntities, users] = await Promise.all([
    db.company.findMany({
      where: {
        ...(clientId ? { clientId } : {}),
        OR: [{ client: { archivedAt: null } }, ...(current?.companyId ? [{ id: current.companyId }] : [])],
      },
      select: { id: true, name: true, client: { select: { name: true } } },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    }),
    db.serviceType.findMany({
      where: { OR: [{ active: true }, ...(current?.serviceTypeId ? [{ id: current.serviceTypeId }] : [])] },
      select: { id: true, name: true, govEntityId: true },
      orderBy: { order: "asc" },
    }),
    db.govEntity.findMany({
      where: { OR: [{ active: true }, ...(current?.govEntityId ? [{ id: current.govEntityId }] : [])] },
      select: { id: true, name: true },
      orderBy: { order: "asc" },
    }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { companies, serviceTypes, govEntities, users };
}
