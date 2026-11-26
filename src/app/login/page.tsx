"use client";

import Image from "next/image";
import { startTransition, useActionState } from "react";
import { BRAND } from "@/lib/brand";
import SaduBand from "@/components/ui/SaduBand";
import { login } from "./actions";

// نقشة السدو الكبيرة خلف لوحة الهوية
function SaduBackdrop() {
  return (
    <svg width="100%" height="100%" aria-hidden="true" className="absolute inset-0 opacity-20">
      <defs>
        <pattern id="sadu-login" width="96" height="64" patternUnits="userSpaceOnUse">
          <polygon points="48,4 92,32 48,60 4,32" fill="none" stroke="#D8C3A5" strokeWidth="1.5" />
          <polygon points="48,18 70,32 48,46 26,32" fill="#7D0000" />
          <polygon points="48,26 57,32 48,38 39,32" fill="#D8C3A5" />
          <polygon points="0,0 10,0 0,6" fill="#D8C3A5" />
          <polygon points="96,0 86,0 96,6" fill="#D8C3A5" />
          <polygon points="0,64 10,64 0,58" fill="#D8C3A5" />
          <polygon points="96,64 86,64 96,58" fill="#D8C3A5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#sadu-login)" />
    </svg>
  );
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <main className="min-h-screen grid lg:grid-cols-[minmax(0,640px)_1fr]">
      {/* لوحة الهوية (بتختفي على الموبايل) */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-brand-950 p-16 text-ivory">
        <SaduBackdrop />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-950/20 to-brand-950/95 to-70%" />
        <Image src={BRAND.logoOnDark} alt={BRAND.short} width={320} height={177} priority className="relative w-52 h-auto" />
        <div className="relative space-y-4">
          <p className="font-display text-6xl font-extrabold leading-snug">{BRAND.slogan}</p>
          <p className="max-w-md text-lg leading-loose text-[#e9dfd3]">
            منصة العمل الداخلية لمعاملات العملاء والعقود وشؤون الموظفين والحسابات، في مكان واحد.
          </p>
          <p className="text-sm text-sand">{BRAND.company} {BRAND.tagline}</p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-16">
        <form
          onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); startTransition(() => action(d)); }}
          className="w-full max-w-md space-y-6"
        >
          <div className="space-y-2">
            <Image src={BRAND.logoOnLight} alt={BRAND.short} width={140} height={78} priority className="w-32 h-auto mb-6 lg:hidden" />
            <h1 className="text-3xl font-extrabold">تسجيل الدخول</h1>
            <p className="text-neutral-600">يرجى إدخال بيانات حسابك للمتابعة.</p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-700">البريد الإلكتروني</span>
            <input name="email" type="email" required dir="ltr" autoComplete="email" className="input min-h-12 text-right" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-neutral-700">كلمة المرور</span>
            <input name="password" type="password" required dir="ltr" autoComplete="current-password" className="input min-h-12 text-right" />
          </label>

          {state?.error && <p className="text-sm text-rose-700 bg-rose-50 rounded-xl p-3">{state.error}</p>}

          <button disabled={pending} className="btn-primary w-full min-h-12 text-base">
            {pending ? "جارٍ الدخول..." : "دخول"}
          </button>
          <p className="text-sm leading-relaxed text-neutral-600">
            نسيت كلمة المرور؟ يرجى التواصل مع مدير النظام لتعيين كلمة مرور مؤقتة.
          </p>
          <SaduBand tone="light" size={10} className="mt-4" />
        </form>
      </section>
    </main>
  );
}
