"use client";

import Image from "next/image";
import { startTransition, useActionState, useState } from "react";
import { Eye, EyeOff, Handshake, Lock, LogIn, Rocket, ShieldCheck, TrendingUp, User } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { login } from "./actions";

const FEATURES = [
  { icon: Handshake, label: "شريكك الدائم" },
  { icon: TrendingUp, label: "تسهيل أعمالك" },
  { icon: ShieldCheck, label: "الالتزام بالأنظمة" },
  { icon: Rocket, label: "نمو أكبر" },
];

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  const [show, setShow] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-navy-950 text-white">
      {/* الخلفية: ليل كحلي بإضاءة ذهبية خلف معالم المملكة */}
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(900px_600px_at_30%_45%,rgba(212,165,72,0.16),transparent_65%),radial-gradient(700px_500px_at_90%_10%,rgba(53,89,181,0.22),transparent_60%),linear-gradient(180deg,var(--color-navy-900),var(--color-navy-950))]" />

      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-10 lg:grid-cols-[440px_1fr] lg:px-10">
        {/* بطاقة الدخول الزجاجية */}
        <form
          onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); startTransition(() => action(d)); }}
          className="w-full max-w-md justify-self-center rounded-3xl border border-white/70 bg-white/92 p-8 text-ink shadow-2xl shadow-black/40 ring-1 ring-gold-400/40 backdrop-blur-xl sm:p-10 lg:justify-self-start"
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <Image src={BRAND.landmarks} alt="" width={1080} height={705} priority className="-mt-2 mb-1 h-auto w-56 lg:hidden" />
            <Image src={BRAND.logoOnLight} alt={BRAND.short} width={180} height={100} priority className="h-auto w-36" />
            <p className="text-sm font-semibold text-navy-800">{BRAND.tagline}</p>
            <p className="font-display text-lg font-bold text-gold-600 lg:hidden">{BRAND.slogan}</p>
          </div>

          <div className="mt-6 text-center">
            <h1 className="text-3xl font-extrabold">تسجيل الدخول</h1>
            <div className="mx-auto mt-3 h-0.5 w-40 bg-gradient-to-l from-transparent via-gold-500 to-transparent" />
            <p className="mt-3 text-sm text-neutral-600">أهلاً بك مجدداً، يرجى إدخال بيانات حسابك.</p>
          </div>

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="sr-only">البريد الإلكتروني</span>
              <span className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 shadow-sm focus-within:border-gold-500 focus-within:ring-3 focus-within:ring-gold-500/25">
                <User size={18} className="shrink-0 text-navy-700" aria-hidden="true" />
                <input name="email" type="email" required dir="ltr" autoComplete="email" placeholder="البريد الإلكتروني"
                  className="min-h-13 w-full bg-transparent text-right text-[15px] outline-none placeholder:text-neutral-500" />
              </span>
            </label>
            <label className="block">
              <span className="sr-only">كلمة المرور</span>
              <span className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 shadow-sm focus-within:border-gold-500 focus-within:ring-3 focus-within:ring-gold-500/25">
                <Lock size={18} className="shrink-0 text-navy-700" aria-hidden="true" />
                <input name="password" type={show ? "text" : "password"} required dir="ltr" autoComplete="current-password" placeholder="كلمة المرور"
                  className="min-h-13 w-full bg-transparent text-right text-[15px] outline-none placeholder:text-neutral-500" />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
          </div>

          {state?.error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>}

          <button disabled={pending} className="btn-primary mt-6 min-h-13 w-full rounded-2xl text-base">
            <LogIn size={18} /> {pending ? "جارٍ الدخول..." : "دخول"}
          </button>

          <p className="mt-5 text-center text-xs leading-relaxed text-neutral-600">
            نسيت كلمة المرور؟ يرجى التواصل مع مدير النظام لتعيين كلمة مرور مؤقتة.
          </p>
          <p className="mt-4 flex items-center justify-center gap-1.5 border-t border-neutral-200 pt-4 text-xs font-semibold text-navy-800">
            <ShieldCheck size={15} className="text-gold-600" aria-hidden="true" /> بياناتك آمنة ومحمية
          </p>
        </form>

        {/* رسالة الترحيب */}
        <section className="hidden flex-col items-center gap-6 text-center lg:flex">
          <div className="relative w-full max-w-xl">
            <div aria-hidden="true" className="absolute inset-x-10 bottom-0 top-1/4 rounded-full bg-gold-400/20 blur-3xl" />
            <Image src={BRAND.landmarks} alt="معالم المملكة العربية السعودية" width={1080} height={705} priority sizes="576px" className="relative h-auto w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]" />
          </div>
          <div className="space-y-2">
            <p className="font-display text-4xl font-bold">مرحباً بك في</p>
            <p className="font-display text-7xl font-extrabold leading-snug text-gold-gradient drop-shadow">منصة NGT</p>
            <p className="font-display text-3xl font-bold">{BRAND.slogan}</p>
            <div className="mx-auto mt-4 h-0.5 w-48 bg-gradient-to-l from-transparent via-gold-400 to-transparent" />
          </div>
          <ul className="mt-6 grid grid-cols-4 gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex w-28 flex-col items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-2 py-4 backdrop-blur-md">
                <Icon size={30} className="text-gold-400" aria-hidden="true" />
                <span className="text-sm font-semibold">{label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-navy-100">{BRAND.company} {BRAND.tagline}</p>
        </section>
      </div>
    </main>
  );
}
