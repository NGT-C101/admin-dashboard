import ActionForm from "@/components/ui/ActionForm";
import { Field, FieldGrid } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/company";
import { formatIban } from "@/lib/hr";
import { saveCompany } from "./actions";

export default async function CompanySettingsPage() {
  await requireAdmin();
  const p = await getCompanyProfile();
  const missing = !p.legalName || !p.vatNumber;

  return (
    <div className="space-y-6">
      <PageHeader title="بيانات المنشأة" crumbs={[{ label: "الإعدادات" }, { label: "بيانات المنشأة" }]} />
      <p className="text-sm text-neutral-600">
        تظهر هذه البيانات في عروض الأسعار والفواتير. يرجى إدخالها كما وردت في شهادة التسجيل في ضريبة القيمة المضافة.
      </p>
      {missing && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
          لم تُستكمل بيانات المنشأة بعد، ولن يظهر الرقم الضريبي في عروض الأسعار حتى يتم إدخاله.
        </p>
      )}
      <div className="card p-5">
        <ActionForm action={saveCompany} submitLabel="حفظ البيانات" resetOnSuccess={false}>
          <h2 className="text-base font-bold">البيانات النظامية</h2>
          <FieldGrid>
            <Field label="الاسم القانوني للمنشأة *"><input name="legalName" required defaultValue={p.legalName} className="input" /></Field>
            <Field label="الرقم الضريبي *"><input name="vatNumber" required inputMode="numeric" dir="ltr" maxLength={15} defaultValue={p.vatNumber} className="input" /></Field>
            <Field label="الرقم الموحد للسجل التجاري *"><input name="crNumber" required inputMode="numeric" dir="ltr" maxLength={10} defaultValue={p.crNumber} className="input" /></Field>
            <Field label="العنوان الوطني *" wide><input name="address" required defaultValue={p.address} placeholder="الرياض، حي ...، الرمز البريدي ..." className="input" /></Field>
          </FieldGrid>
          <h2 className="pt-2 text-base font-bold">التواصل والحساب البنكي</h2>
          <FieldGrid>
            <Field label="رقم الهاتف"><input name="phone" dir="ltr" defaultValue={p.phone} className="input" /></Field>
            <Field label="البريد الإلكتروني"><input name="email" type="email" dir="ltr" defaultValue={p.email} className="input" /></Field>
            <Field label="اسم البنك"><input name="bankName" defaultValue={p.bankName} className="input" /></Field>
            <Field label="رقم الآيبان"><input name="iban" dir="ltr" defaultValue={formatIban(p.iban)} placeholder="SA00 0000 0000 0000 0000 0000" className="input" /></Field>
          </FieldGrid>
          <h2 className="pt-2 text-base font-bold">عروض الأسعار</h2>
          <FieldGrid>
            <Field label="مدة صلاحية العرض (بالأيام) *"><input name="quoteValidityDays" type="number" min={1} max={90} required defaultValue={p.quoteValidityDays} className="input" /></Field>
            <Field label="الشروط الافتراضية في عرض السعر" wide><textarea name="quoteTerms" rows={3} defaultValue={p.quoteTerms} className="input" /></Field>
          </FieldGrid>
        </ActionForm>
      </div>
    </div>
  );
}
