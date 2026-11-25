import type { Transaction } from "@prisma/client";
import { Field, FieldGrid } from "@/components/ui/Field";
import { dateInputValue } from "@/lib/format";

type Opt = { id: string; name: string };
export type TxFormOptions = {
  companies: { id: string; name: string; client: { name: string } }[];
  serviceTypes: Opt[];
  govEntities: Opt[];
  users: Opt[];
};

export default function TransactionFields({ tx, options, companyId }: {
  tx?: Transaction; options: TxFormOptions; companyId?: string;
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
          <option value="" disabled>اختار الشركة</option>
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
      <Field label="نوع الخدمة">
        <select name="serviceTypeId" defaultValue={tx?.serviceTypeId ?? ""} className="input">
          <option value="">—</option>
          {options.serviceTypes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="الجهة / المنصة الحكومية">
        <select name="govEntityId" defaultValue={tx?.govEntityId ?? ""} className="input">
          <option value="">—</option>
          {options.govEntities.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="الموظف المسؤول">
        <select name="assigneeId" defaultValue={tx?.assigneeId ?? ""} className="input">
          <option value="">غير محدد</option>
          {options.users.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
      <Field label="الموعد المستهدف للإنجاز">
        <input name="dueDate" type="date" defaultValue={dateInputValue(tx?.dueDate)} className="input" />
      </Field>
      <Field label="التفاصيل" wide>
        <textarea name="description" rows={3} defaultValue={tx?.description ?? ""} className="input" />
      </Field>
    </FieldGrid>
  );
}

export async function loadTxOptions(db: typeof import("@/lib/db").db, clientId?: string): Promise<TxFormOptions> {
  const [companies, serviceTypes, govEntities, users] = await Promise.all([
    db.company.findMany({
      where: clientId ? { clientId } : undefined,
      select: { id: true, name: true, client: { select: { name: true } } },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    }),
    db.serviceType.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { order: "asc" } }),
    db.govEntity.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { order: "asc" } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { companies, serviceTypes, govEntities, users };
}
