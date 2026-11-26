"use client";

// خانة تاريخ ميلادي: يوم + شهر (بالأسماء الميلادية) + سنة تُكتب يدوياً
// بترسل القيمة بصيغة YYYY-MM-DD في حقل مخفي بالاسم المطلوب
import { useEffect, useRef, useState } from "react";
import { GREGORIAN_MONTHS } from "@/lib/time";

const pad = (n: number) => String(n).padStart(2, "0");
function split(v?: string) {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: m[1], m: String(Number(m[2])), d: String(Number(m[3])) } : { y: "", m: "", d: "" };
}
const daysIn = (y: number, m: number) => new Date(Date.UTC(y || 2000, m, 0)).getUTCDate();

export default function DateField({ name, defaultValue, required, withTime, defaultTime, ariaLabel }: {
  name: string;
  defaultValue?: string; // YYYY-MM-DD أو YYYY-MM-DDTHH:MM
  required?: boolean;
  withTime?: boolean; // يرسل YYYY-MM-DDTHH:MM
  defaultTime?: string;
  ariaLabel?: string;
}) {
  const init = split(defaultValue);
  const initTime = withTime ? defaultValue?.slice(11, 16) || defaultTime || "" : "";
  const [d, setD] = useState(init.d), [m, setM] = useState(init.m), [y, setY] = useState(init.y), [t, setT] = useState(initTime);
  const yearRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const anyFilled = !!(d || m || y);
  const yearOk = /^\d{4}$/.test(y) && Number(y) >= 1900 && Number(y) <= 2100;
  const complete = !!(d && m && yearOk);
  const dayOk = complete && Number(d) <= daysIn(Number(y), Number(m));
  const value = complete && dayOk ? `${y}-${pad(Number(m))}-${pad(Number(d))}${withTime && t ? `T${t}` : withTime ? "T09:00" : ""}` : "";

  // رسالة واضحة لو التاريخ ناقص أو غلط (المتصفح بيمنع الإرسال)
  useEffect(() => {
    const msg = !anyFilled ? (required ? "يرجى إدخال التاريخ" : "")
      : !complete ? "يرجى إكمال التاريخ (اليوم والشهر والسنة)"
      : !dayOk ? "التاريخ غير صحيح" : "";
    yearRef.current?.setCustomValidity(msg);
  }, [anyFilled, complete, dayOk, required]);

  // لما الفورم يتفضّى بعد الحفظ نرجّع القيمة الافتراضية
  useEffect(() => {
    const form = wrapRef.current?.closest("form");
    if (!form) return;
    const onReset = () => { setD(init.d); setM(init.m); setY(init.y); setT(initTime); };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [init.d, init.m, init.y, initTime]);

  return (
    <div ref={wrapRef} className="flex flex-wrap items-center gap-1.5" aria-label={ariaLabel}>
      <input type="hidden" name={name} value={value} />
      <select value={d} onChange={(e) => setD(e.target.value)} className="input !w-[4.5rem] !px-2" aria-label="اليوم">
        <option value="">يوم</option>
        {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select>
      <select value={m} onChange={(e) => setM(e.target.value)} className="input !w-[6.5rem] !px-2" aria-label="الشهر">
        <option value="">الشهر</option>
        {GREGORIAN_MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <input ref={yearRef} value={y} onChange={(e) => setY(e.target.value.replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).slice(0, 4))}
        inputMode="numeric" placeholder="السنة" dir="ltr" className="input !w-[5rem] !px-2 text-center" aria-label="السنة" />
      {withTime && <input type="time" value={t} onChange={(e) => setT(e.target.value)} className="input !w-[7rem] !px-2" aria-label="الوقت" />}
      {anyFilled && !required && (
        <button type="button" onClick={() => { setD(""); setM(""); setY(""); setT(""); }} className="text-xs text-neutral-500 hover:text-rose-600 px-1" title="مسح">✕</button>
      )}
    </div>
  );
}

// اختيار شهر وسنة (للفلاتر والتقارير)
export function MonthField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [y0, m0] = defaultValue.split("-");
  const [m, setM] = useState(String(Number(m0))), [y, setY] = useState(y0);
  const value = /^\d{4}$/.test(y) && m ? `${y}-${pad(Number(m))}` : "";
  return (
    <div className="flex items-center gap-1.5">
      <input type="hidden" name={name} value={value} />
      <select value={m} onChange={(e) => setM(e.target.value)} className="input !w-[6.5rem] !px-2" aria-label="الشهر">
        {GREGORIAN_MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <input value={y} onChange={(e) => setY(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" dir="ltr" className="input !w-[5rem] !px-2 text-center" aria-label="السنة" />
    </div>
  );
}
