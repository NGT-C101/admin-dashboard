"use client";

// خيار إنشاء حساب دخول للموظف مع صلاحياته
import { useState } from "react";
import PermissionMatrix from "@/components/PermissionMatrix";
import { Field, FieldGrid } from "@/components/ui/Field";

export default function LoginFields({ sections, defaultOn = true, toggle = true }: {
  sections: { department: string; title: string }[];
  defaultOn?: boolean;
  toggle?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="space-y-4">
      {toggle && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="createLogin" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-4 accent-brand-600" />
          منح الموظف حساب دخول على المنصة
        </label>
      )}
      {on && (
        <>
          <FieldGrid>
            <Field label="البريد الإلكتروني للدخول *"><input name="loginEmail" type="email" required dir="ltr" autoComplete="off" className="input" /></Field>
            <Field label="كلمة مرور مؤقتة * (10 أحرف على الأقل)">
              <input name="loginPassword" type="text" required minLength={10} dir="ltr" autoComplete="off" className="input" />
            </Field>
          </FieldGrid>
          <p className="text-xs text-neutral-500">سيُطلب من الموظف تغيير كلمة المرور المؤقتة عند أول دخول.</p>
          <PermissionMatrix sections={sections} canGrantAdmin />
        </>
      )}
    </div>
  );
}
