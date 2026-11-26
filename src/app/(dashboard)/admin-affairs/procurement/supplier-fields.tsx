import type { Supplier } from "@prisma/client";
import { Field, FieldGrid } from "@/components/ui/Field";
import { formatIban } from "@/lib/hr";

export default function SupplierFields({ s }: { s?: Supplier }) {
  return (
    <FieldGrid>
      {s && <input type="hidden" name="id" value={s.id} />}
      <Field label="اسم المورد *"><input name="name" required defaultValue={s?.name} autoComplete="off" className="input" /></Field>
      <Field label="نوع التوريد"><input name="category" defaultValue={s?.category ?? ""} placeholder="مثال: أجهزة حاسب، أثاث، قرطاسية…" autoComplete="off" className="input" /></Field>
      <Field label="المسؤول"><input name="contactName" defaultValue={s?.contactName ?? ""} autoComplete="off" className="input" /></Field>
      <Field label="الجوال"><input name="phone" type="tel" inputMode="tel" dir="ltr" defaultValue={s?.phone ?? ""} autoComplete="off" className="input" /></Field>
      <Field label="البريد الإلكتروني"><input name="email" type="email" dir="ltr" defaultValue={s?.email ?? ""} autoComplete="off" spellCheck={false} className="input" /></Field>
      <Field label="المدينة"><input name="city" defaultValue={s?.city ?? ""} autoComplete="off" className="input" /></Field>
      <Field label="السجل التجاري / الرقم الموحد"><input name="crNumber" inputMode="numeric" maxLength={10} dir="ltr" defaultValue={s?.crNumber ?? ""} autoComplete="off" className="input" /></Field>
      <Field label="الرقم الضريبي"><input name="vatNumber" inputMode="numeric" maxLength={15} dir="ltr" defaultValue={s?.vatNumber ?? ""} autoComplete="off" className="input" /></Field>
      <Field label="الآيبان"><input name="iban" dir="ltr" defaultValue={s?.iban ? formatIban(s.iban) : ""} placeholder="SA…" autoComplete="off" spellCheck={false} className="input" /></Field>
      {s && (
        <Field label="الحالة">
          <select name="active" defaultValue={s.active ? "on" : "off"} className="input"><option value="on">نشط</option><option value="off">موقوف</option></select>
        </Field>
      )}
      <Field label="ملاحظات" wide><textarea name="notes" rows={2} defaultValue={s?.notes ?? ""} className="input" /></Field>
    </FieldGrid>
  );
}
