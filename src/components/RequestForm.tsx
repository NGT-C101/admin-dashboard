"use client";

// طلب إجازة أو استئذان (بالساعات)
import { useState } from "react";
import ActionForm from "@/components/ui/ActionForm";
import { Field, FieldGrid } from "@/components/ui/Field";
import { submitRequest } from "@/app/(dashboard)/employees/leave-actions";

export default function RequestForm({ leaveTypes, employees, today }: {
  leaveTypes: [string, string][];
  employees?: { id: string; fullName: string }[]; // لتقديم طلب نيابةً عن موظف
  today: string;
}) {
  const [kind, setKind] = useState<"LEAVE" | "PERMISSION">("LEAVE");
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-neutral-100 p-1 text-sm">
        {([["LEAVE", "طلب إجازة"], ["PERMISSION", "طلب استئذان"]] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setKind(v)}
            className={`rounded-md px-4 py-1.5 ${kind === v ? "bg-white shadow-sm font-semibold text-brand-800" : "text-neutral-600"}`}>{l}</button>
        ))}
      </div>
      <ActionForm key={kind} action={submitRequest} submitLabel="تقديم الطلب">
        <input type="hidden" name="kind" value={kind} />
        <FieldGrid>
          {employees && (
            <Field label="الموظف *">
              <select name="employeeId" required defaultValue="" className="input">
                <option value="" disabled>اختر الموظف</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
            </Field>
          )}
          {kind === "LEAVE" ? (
            <>
              <Field label="نوع الإجازة *">
                <select name="type" required defaultValue="ANNUAL" className="input">
                  {leaveTypes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="من تاريخ *"><input name="startDate" type="date" required min={employees ? undefined : today} className="input" /></Field>
              <Field label="إلى تاريخ *"><input name="endDate" type="date" required min={employees ? undefined : today} className="input" /></Field>
            </>
          ) : (
            <>
              <Field label="التاريخ *"><input name="date" type="date" required defaultValue={today} className="input" /></Field>
              <Field label="من الساعة *"><input name="startTime" type="time" required className="input" /></Field>
              <Field label="إلى الساعة *"><input name="endTime" type="time" required className="input" /></Field>
            </>
          )}
          <Field label="السبب / ملاحظات" wide>
            <textarea name="reason" rows={2} className="input" placeholder={kind === "LEAVE" ? "اختياري" : "مثال: مراجعة جهة حكومية"} />
          </Field>
        </FieldGrid>
        {kind === "LEAVE" && <p className="text-xs text-neutral-500">تُحسب أيام العمل فقط (الأحد إلى الخميس) مع استبعاد العطلات الرسمية.</p>}
      </ActionForm>
    </div>
  );
}
