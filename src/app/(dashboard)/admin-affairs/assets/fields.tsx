import type { Asset } from "@prisma/client";
import DateField from "@/components/ui/DateField";
import { Field, FieldGrid } from "@/components/ui/Field";
import { dateInputValue } from "@/lib/format";

export default function AssetFields({ asset, categories }: { asset?: Asset; categories: { id: string; name: string }[] }) {
  return (
    <FieldGrid>
      {asset && <input type="hidden" name="id" value={asset.id} />}
      <Field label="اسم الأصل *"><input name="name" required defaultValue={asset?.name} placeholder="مثال: حاسب محمول Dell Latitude 5440…" autoComplete="off" className="input" /></Field>
      <Field label="التصنيف *">
        <select name="categoryId" required defaultValue={asset?.categoryId ?? ""} className="input">
          <option value="" disabled>اختر التصنيف</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="الماركة / الموديل"><input name="brand" defaultValue={asset?.brand ?? ""} autoComplete="off" className="input" /></Field>
      <Field label="الرقم التسلسلي أو رقم اللوحة"><input name="serialNumber" defaultValue={asset?.serialNumber ?? ""} dir="ltr" autoComplete="off" spellCheck={false} className="input" /></Field>
      <Field label="الموقع"><input name="location" defaultValue={asset?.location ?? ""} placeholder="مثال: المكتب الرئيسي — الدور الأول…" autoComplete="off" className="input" /></Field>
      <Field label="المورد"><input name="supplier" defaultValue={asset?.supplier ?? ""} autoComplete="off" className="input" /></Field>
      <Field label="تاريخ الشراء"><DateField name="purchaseDate" defaultValue={dateInputValue(asset?.purchaseDate)} /></Field>
      <Field label="سعر الشراء (ريال)"><input name="purchasePrice" inputMode="decimal" dir="ltr" defaultValue={asset?.purchasePrice?.toString() ?? ""} placeholder="4500…" autoComplete="off" className="input tabular-nums" /></Field>
      <Field label="انتهاء الضمان"><DateField name="warrantyEnd" defaultValue={dateInputValue(asset?.warrantyEnd)} /></Field>
      <Field label="ملاحظات" wide><textarea name="notes" rows={2} defaultValue={asset?.notes ?? ""} className="input" /></Field>
    </FieldGrid>
  );
}
