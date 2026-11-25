"use client";

import Image from "next/image";
import { startTransition, useActionState } from "react";
import { BRAND } from "@/lib/brand";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* لوحة الهوية (بتختفي على الموبايل) */}
      <section className="hidden lg:flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 p-12 text-center">
        <Image src={BRAND.logoOnDark} alt={BRAND.short} width={320} height={177} priority className="w-72 h-auto drop-shadow-xl" />
        <div className="space-y-2">
          <p className="text-2xl font-bold text-white">{BRAND.company}</p>
          <p className="text-neutral-300">{BRAND.tagline}</p>
        </div>
        <p className="mt-6 border-t border-white/20 pt-6 text-lg text-neutral-200">{BRAND.slogan}</p>
      </section>

      <section className="flex items-center justify-center p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); startTransition(() => action(d)); }}
          className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 space-y-5"
        >
          <div className="text-center space-y-3">
            <Image src={BRAND.logoOnLight} alt={BRAND.short} width={140} height={78} priority className="mx-auto w-32 h-auto lg:hidden" />
            <h1 className="text-xl font-bold text-neutral-800">{BRAND.name}</h1>
            <p className="text-sm text-neutral-500">سجّل الدخول للمتابعة</p>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-neutral-700">البريد الإلكتروني</span>
            <input name="email" type="email" required dir="ltr" autoComplete="email" className="input" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-neutral-700">كلمة المرور</span>
            <input name="password" type="password" required dir="ltr" autoComplete="current-password" className="input" />
          </label>

          {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{state.error}</p>}

          <button disabled={pending} className="btn-primary w-full">
            {pending ? "جاري الدخول..." : "دخول"}
          </button>
        </form>
      </section>
    </main>
  );
}
