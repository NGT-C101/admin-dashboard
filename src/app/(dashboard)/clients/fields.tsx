// حقول فورم العميل والشركة (مستخدمة في الإضافة والتعديل)
import type { Client, Company } from "@prisma/client";
import { Field, FieldGrid } from "@/components/ui/Field";
import { dateInputValue } from "@/lib/format";

export function ClientFields({ client }: { client?: Client }) {
  return (
    <FieldGrid>
      {client && <input type="hidden" name="id" value={client.id} />}
      <Field label="الاسم *"><input name="name" required defaultValue={client?.name} className="input" /></Field>
      <Field label="رقم الهوية / الإقامة">
        <input name="nationalId" inputMode="numeric" maxLength={10} dir="ltr" defaultValue={client?.nationalId ?? ""} className="input" />
      </Field>
      <Field label="الجوال">
        <input name="phone" dir="ltr" placeholder="05xxxxxxxx" defaultValue={client?.phone ?? ""} className="input" />
      </Field>
      <Field label="البريد الإلكتروني">
        <input name="email" type="email" dir="ltr" defaultValue={client?.email ?? ""} className="input" />
      </Field>
      <Field label="الجنسية"><input name="nationality" defaultValue={client?.nationality ?? ""} className="input" /></Field>
      {!client && (
        // عند الإضافة بس: تسجيل أول شركة للعميل مع بياناته
        <>
          <div className="sm:col-span-2 lg:col-span-3 border-t border-neutral-100 pt-3 text-sm font-medium text-neutral-700">
            شركة العميل <span className="font-normal text-neutral-500">(اختياري، وتقدر تضيف شركات تانية بعدين)</span>
          </div>
          <Field label="اسم الشركة"><input name="companyName" className="input" /></Field>
          <Field label="رقم السجل التجاري">
            <input name="companyCr" inputMode="numeric" maxLength={10} dir="ltr" className="input" />
          </Field>
        </>
      )}
      <Field label="ملاحظات" wide>
        <textarea name="notes" rows={2} defaultValue={client?.notes ?? ""} className="input" />
      </Field>
    </FieldGrid>
  );
}

const LEGAL_FORMS = ["مؤسسة فردية", "شركة ذات مسؤولية محدودة", "شركة شخص واحد", "شركة مساهمة مبسطة", "شركة مساهمة", "شركة تضامن", "فرع شركة أجنبية"];

export function CompanyFields({ company, clients, clientId }: {
  company?: Company;
  clients?: { id: string; name: string }[];
  clientId?: string;
}) {
  return (
    <FieldGrid>
      {company && <input type="hidden" name="id" value={company.id} />}
      {clients ? (
        <Field label="العميل المالك *">
          <select name="clientId" required defaultValue={company?.clientId ?? clientId ?? ""} className="input">
            <option value="" disabled>اختار العميل</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="clientId" value={company?.clientId ?? clientId} />
      )}
      <Field label="اسم الشركة *"><input name="name" required defaultValue={company?.name} className="input" /></Field>
      <Field label="رقم السجل التجاري">
        <input name="crNumber" inputMode="numeric" maxLength={10} dir="ltr" defaultValue={company?.crNumber ?? ""} className="input" />
      </Field>
      <Field label="الرقم الموحد (700)">
        <input name="unifiedNumber" inputMode="numeric" maxLength={10} dir="ltr" defaultValue={company?.unifiedNumber ?? ""} className="input" />
      </Field>
      <Field label="الكيان القانوني">
        <input name="legalForm" list="legal-forms" defaultValue={company?.legalForm ?? ""} className="input" />
        <datalist id="legal-forms">{LEGAL_FORMS.map((f) => <option key={f} value={f} />)}</datalist>
      </Field>
      <Field label="المدينة"><input name="city" defaultValue={company?.city ?? ""} className="input" /></Field>
      <Field label="النشاط"><input name="activity" defaultValue={company?.activity ?? ""} className="input" /></Field>
      <Field label="تاريخ انتهاء السجل">
        <input name="crExpiry" type="date" defaultValue={dateInputValue(company?.crExpiry)} className="input" />
      </Field>
      <Field label="ملاحظات" wide>
        <textarea name="notes" rows={2} defaultValue={company?.notes ?? ""} className="input" />
      </Field>
    </FieldGrid>
  );
}
