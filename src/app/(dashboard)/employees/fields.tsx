import DateField from "@/components/ui/DateField";
import type { Employee } from "@prisma/client";
import { Field, FieldGrid } from "@/components/ui/Field";
import { dateInputValue } from "@/lib/format";
import { EMPLOYMENT_TYPE_LABELS, GENDER_LABELS, MARITAL_STATUSES, ORG_DEPARTMENTS, formatIban } from "@/lib/hr";

export function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-brand-900">{title}</h2>
        {hint && <p className="text-xs text-neutral-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const money = (v?: { toString(): string } | null) => v?.toString() ?? "";

export function PersonalFields({ e }: { e?: Employee }) {
  return (
    <FieldGrid>
      <Field label="الاسم الكامل *"><input name="fullName" required defaultValue={e?.fullName} className="input" /></Field>
      <Field label="الاسم بالإنجليزية"><input name="fullNameEn" dir="ltr" defaultValue={e?.fullNameEn ?? ""} className="input" /></Field>
      <Field label="الجنس">
        <select name="gender" defaultValue={e?.gender ?? ""} className="input">
          <option value="">—</option>
          {Object.entries(GENDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="تاريخ الميلاد"><DateField name="birthDate" defaultValue={dateInputValue(e?.birthDate)} /></Field>
      <Field label="الحالة الاجتماعية">
        <select name="maritalStatus" defaultValue={e?.maritalStatus ?? ""} className="input">
          <option value="">—</option>
          {MARITAL_STATUSES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="الجنسية"><input name="nationality" defaultValue={e?.nationality ?? ""} className="input" /></Field>
    </FieldGrid>
  );
}

export function IdentityFields({ e }: { e?: Employee }) {
  return (
    <FieldGrid>
      <Field label="رقم الهوية / الإقامة">
        <input name="nationalId" inputMode="numeric" maxLength={10} dir="ltr" defaultValue={e?.nationalId ?? ""} className="input" />
      </Field>
      <Field label="تاريخ انتهاء الهوية / الإقامة"><DateField name="idExpiry" defaultValue={dateInputValue(e?.idExpiry)} /></Field>
      <span className="hidden lg:block" />
      <Field label="رقم جواز السفر"><input name="passportNumber" dir="ltr" defaultValue={e?.passportNumber ?? ""} className="input" /></Field>
      <Field label="تاريخ انتهاء الجواز"><DateField name="passportExpiry" defaultValue={dateInputValue(e?.passportExpiry)} /></Field>
    </FieldGrid>
  );
}

export function ContactFields({ e }: { e?: Employee }) {
  return (
    <FieldGrid>
      <Field label="الجوال"><input name="phone" dir="ltr" placeholder="05xxxxxxxx" defaultValue={e?.phone ?? ""} className="input" /></Field>
      <Field label="البريد الشخصي"><input name="personalEmail" type="email" dir="ltr" defaultValue={e?.personalEmail ?? ""} className="input" /></Field>
      <Field label="المدينة"><input name="city" defaultValue={e?.city ?? ""} className="input" /></Field>
      <Field label="العنوان" wide><input name="address" defaultValue={e?.address ?? ""} className="input" /></Field>
      <Field label="جهة اتصال الطوارئ"><input name="emergencyName" defaultValue={e?.emergencyName ?? ""} className="input" /></Field>
      <Field label="صلة القرابة"><input name="emergencyRelation" defaultValue={e?.emergencyRelation ?? ""} className="input" /></Field>
      <Field label="جوال الطوارئ"><input name="emergencyPhone" dir="ltr" defaultValue={e?.emergencyPhone ?? ""} className="input" /></Field>
    </FieldGrid>
  );
}

export type Leader = { title: string; holder: { id: string; fullName: string } | null };

export function JobFields({ e, managers, leaders = [] }: {
  e?: Employee;
  managers: { id: string; fullName: string; jobTitle: string }[];
  leaders?: Leader[]; // المناصب القيادية بالترتيب
}) {
  const leaderIds = new Set(leaders.map((l) => l.holder?.id).filter(Boolean));
  return (
    <FieldGrid>
      <Field label="المسمى الوظيفي *"><input name="jobTitle" required defaultValue={e?.jobTitle} placeholder="مثال: أخصائي معاملات حكومية" className="input" /></Field>
      <Field label="الإدارة">
        <input name="orgDepartment" list="org-departments" defaultValue={e?.orgDepartment ?? ""} className="input" />
        <datalist id="org-departments">{ORG_DEPARTMENTS.map((d) => <option key={d} value={d} />)}</datalist>
      </Field>
      <Field label="المدير المباشر">
        <select name="managerId" defaultValue={e?.managerId ?? ""} className="input">
          <option value="">—</option>
          {leaders.length > 0 && (
            <optgroup label="الإدارة والمناصب القيادية">
              {leaders.map((l) => (
                <option key={l.title} value={l.holder?.id ?? ""} disabled={!l.holder || l.holder.id === e?.id}>
                  {l.title} — {l.holder ? l.holder.fullName : "شاغر"}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="الموظفون">
            {managers.filter((m) => m.id !== e?.id && !leaderIds.has(m.id)).map((m) => <option key={m.id} value={m.id}>{m.fullName} — {m.jobTitle}</option>)}
          </optgroup>
        </select>
      </Field>
      <Field label="نوع التعاقد">
        <select name="employmentType" defaultValue={e?.employmentType ?? "FULL_TIME"} className="input">
          {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="تاريخ الالتحاق *"><DateField name="hireDate" defaultValue={dateInputValue(e?.hireDate ?? new Date())} required /></Field>
      <Field label="نهاية فترة التجربة"><DateField name="probationEnd" defaultValue={dateInputValue(e?.probationEnd)} /></Field>
      <Field label="تاريخ انتهاء العقد"><DateField name="contractEnd" defaultValue={dateInputValue(e?.contractEnd)} /></Field>
      <Field label="مقر العمل"><input name="workLocation" defaultValue={e?.workLocation ?? ""} placeholder="مثال: المقر الرئيسي — الرياض" className="input" /></Field>
      <Field label="ملاحظات" wide><textarea name="notes" rows={2} defaultValue={e?.notes ?? ""} className="input" /></Field>
    </FieldGrid>
  );
}

export function SalaryFields({ e }: { e?: Employee }) {
  return (
    <FieldGrid>
      <Field label="الراتب الأساسي (ريال)"><input name="basicSalary" inputMode="decimal" dir="ltr" defaultValue={money(e?.basicSalary)} className="input" /></Field>
      <Field label="بدل السكن"><input name="housingAllowance" inputMode="decimal" dir="ltr" defaultValue={money(e?.housingAllowance)} className="input" /></Field>
      <Field label="بدل النقل"><input name="transportAllowance" inputMode="decimal" dir="ltr" defaultValue={money(e?.transportAllowance)} className="input" /></Field>
      <Field label="بدلات أخرى"><input name="otherAllowances" inputMode="decimal" dir="ltr" defaultValue={money(e?.otherAllowances)} className="input" /></Field>
      <Field label="البنك"><input name="bankName" defaultValue={e?.bankName ?? ""} className="input" /></Field>
      <Field label="رقم الآيبان (IBAN)"><input name="iban" dir="ltr" placeholder="SA00 0000 0000 0000 0000 0000" defaultValue={formatIban(e?.iban)} className="input" /></Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
        <input type="checkbox" name="gosiRegistered" defaultChecked={e?.gosiRegistered} className="size-4 accent-brand-600" />
        مسجّل في التأمينات الاجتماعية
      </label>
    </FieldGrid>
  );
}
