// حقول فورم العميل والشركة (مستخدمة في الإضافة والتعديل)
import DateField from "@/components/ui/DateField";
import type { Client, Company } from "@prisma/client";
import { Field, FieldGrid } from "@/components/ui/Field";
import { CLIENT_SOURCES, CLIENT_STATUS_LABELS, NITAQAT_OPTIONS } from "@/lib/clients";
import { dateInputValue } from "@/lib/format";

type Opt = { id: string; name: string };

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="sm:col-span-2 lg:col-span-3 border-t border-neutral-100 pt-3 text-sm font-semibold text-neutral-700">
      {children} {hint && <span className="font-normal text-neutral-500">({hint})</span>}
    </div>
  );
}

export function ClientFields({ client, users }: { client?: Client; users: Opt[] }) {
  return (
    <FieldGrid>
      {client && <input type="hidden" name="id" value={client.id} />}
      <Field label="الاسم *"><input name="name" required defaultValue={client?.name} className="input" /></Field>
      <Field label="رقم الهوية / الإقامة">
        <input name="nationalId" inputMode="numeric" maxLength={10} dir="ltr" defaultValue={client?.nationalId ?? ""} className="input" />
      </Field>
      <Field label="الجنسية"><input name="nationality" defaultValue={client?.nationality ?? ""} className="input" /></Field>
      <Field label="الجوال">
        <input name="phone" dir="ltr" placeholder="05xxxxxxxx" defaultValue={client?.phone ?? ""} className="input" />
      </Field>
      <Field label="جوال آخر">
        <input name="phone2" dir="ltr" placeholder="05xxxxxxxx" defaultValue={client?.phone2 ?? ""} className="input" />
      </Field>
      <Field label="البريد الإلكتروني">
        <input name="email" type="email" dir="ltr" defaultValue={client?.email ?? ""} className="input" />
      </Field>
      <Field label="المدينة"><input name="city" defaultValue={client?.city ?? ""} className="input" /></Field>

      <SectionTitle>التصنيف والمتابعة</SectionTitle>
      <Field label="الحالة">
        <select name="status" defaultValue={client?.status ?? "ACTIVE"} className="input">
          {Object.entries(CLIENT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="الموظف المسؤول عن العميل">
        <select name="accountManagerId" defaultValue={client?.accountManagerId ?? ""} className="input">
          <option value="">غير محدد</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Field label="مصدر العميل">
        <input name="source" list="client-sources" defaultValue={client?.source ?? ""} className="input" />
        <datalist id="client-sources">{CLIENT_SOURCES.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
        <input type="checkbox" name="vip" defaultChecked={client?.vip} className="size-4 accent-brand-600" />
        ⭐ عميل مميز (VIP)
      </label>

      {!client && (
        // عند الإضافة بس: تسجيل أول شركة للعميل مع بياناته
        <>
          <SectionTitle hint="اختياري، ويمكن إضافة شركات أخرى لاحقاً">شركة العميل</SectionTitle>
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
  clients?: Opt[];
  clientId?: string;
}) {
  return (
    <FieldGrid>
      {company && <input type="hidden" name="id" value={company.id} />}
      {clients ? (
        <Field label="العميل المالك *">
          <select name="clientId" required defaultValue={company?.clientId ?? clientId ?? ""} className="input">
            <option value="" disabled>اختر العميل</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="clientId" value={company?.clientId ?? clientId} />
      )}
      <Field label="اسم الشركة *"><input name="name" required defaultValue={company?.name} className="input" /></Field>
      <Field label="الكيان القانوني">
        <input name="legalForm" list="legal-forms" defaultValue={company?.legalForm ?? ""} className="input" />
        <datalist id="legal-forms">{LEGAL_FORMS.map((f) => <option key={f} value={f} />)}</datalist>
      </Field>
      <Field label="المدينة"><input name="city" defaultValue={company?.city ?? ""} className="input" /></Field>
      <Field label="النشاط"><input name="activity" defaultValue={company?.activity ?? ""} className="input" /></Field>

      <SectionTitle>الأرقام الرسمية</SectionTitle>
      <Field label="رقم السجل التجاري">
        <input name="crNumber" inputMode="numeric" maxLength={10} dir="ltr" defaultValue={company?.crNumber ?? ""} className="input" />
      </Field>
      <Field label="تاريخ انتهاء السجل">
        <DateField name="crExpiry" defaultValue={dateInputValue(company?.crExpiry)} />
      </Field>
      <Field label="الرقم الموحد (700)">
        <input name="unifiedNumber" inputMode="numeric" maxLength={10} dir="ltr" defaultValue={company?.unifiedNumber ?? ""} className="input" />
      </Field>
      <Field label="الرقم الضريبي (15 رقم)">
        <input name="vatNumber" inputMode="numeric" maxLength={15} dir="ltr" defaultValue={company?.vatNumber ?? ""} className="input" />
      </Field>
      <Field label="العنوان الوطني المختصر">
        <input name="nationalAddress" dir="ltr" maxLength={8} placeholder="RRRD2929" defaultValue={company?.nationalAddress ?? ""} className="input uppercase" />
      </Field>
      <Field label="رقم ملف مكتب العمل">
        <input name="molFileNumber" dir="ltr" defaultValue={company?.molFileNumber ?? ""} className="input" />
      </Field>
      <Field label="رقم الاشتراك في التأمينات">
        <input name="gosiNumber" inputMode="numeric" dir="ltr" defaultValue={company?.gosiNumber ?? ""} className="input" />
      </Field>

      <SectionTitle>العمالة والسعودة</SectionTitle>
      <Field label="نطاق المنشأة">
        <select name="nitaqat" defaultValue={company?.nitaqat ?? ""} className="input">
          <option value="">—</option>
          {NITAQAT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>
      <Field label="عدد الموظفين السعوديين">
        <input name="saudiCount" type="number" min={0} defaultValue={company?.saudiCount ?? ""} className="input" />
      </Field>
      <Field label="عدد الموظفين غير السعوديين">
        <input name="nonSaudiCount" type="number" min={0} defaultValue={company?.nonSaudiCount ?? ""} className="input" />
      </Field>

      <Field label="ملاحظات" wide>
        <textarea name="notes" rows={2} defaultValue={company?.notes ?? ""} className="input" />
      </Field>
    </FieldGrid>
  );
}
