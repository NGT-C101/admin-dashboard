"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { DEPARTMENT_LABELS, ROLE_LABELS } from "@/lib/nav";
import { createUser } from "./actions";

export default function UserForm() {
  const [state, action, pending] = useActionState(createUser, undefined);
  const [role, setRole] = useState("EMPLOYEE");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setRole("EMPLOYEE");
    }
  }, [state]);

  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); startTransition(() => action(d)); }} className="card p-5 space-y-4">
      <h2 className="font-semibold">إضافة مستخدم جديد</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm text-slate-600">الاسم</span>
          <input name="name" required className="input" />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-slate-600">البريد الإلكتروني</span>
          <input name="email" type="email" required dir="ltr" className="input" />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-slate-600">كلمة المرور</span>
          <input name="password" type="password" required minLength={8} dir="ltr" className="input" />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-slate-600">الدور</span>
          <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className="input">
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {role !== "ADMIN" && (
          <label className="space-y-1">
            <span className="text-sm text-slate-600">القسم</span>
            <select name="department" required className="input" defaultValue="">
              <option value="" disabled>اختر القسم</option>
              {Object.entries(DEPARTMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
      </div>
      {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{state.error}</p>}
      {state?.success && <p className="text-sm text-teal-700 bg-teal-50 rounded-lg p-2">{state.success}</p>}
      <button disabled={pending} className="btn-primary">
        <UserPlus size={16} /> {pending ? "جاري الحفظ..." : "إضافة"}
      </button>
    </form>
  );
}
