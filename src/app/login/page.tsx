"use client";

import { startTransition, useActionState } from "react";
import { Building2 } from "lucide-react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <form onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); startTransition(() => action(d)); }} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-teal-700 text-white flex items-center justify-center">
            <Building2 size={26} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">منصة الإدارة</h1>
          <p className="text-sm text-slate-500">سجّل الدخول للمتابعة</p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">البريد الإلكتروني</span>
          <input name="email" type="email" required dir="ltr" autoComplete="email" className="input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">كلمة المرور</span>
          <input name="password" type="password" required dir="ltr" autoComplete="current-password" className="input" />
        </label>

        {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{state.error}</p>}

        <button disabled={pending} className="btn-primary w-full">
          {pending ? "جاري الدخول..." : "دخول"}
        </button>
      </form>
    </main>
  );
}
