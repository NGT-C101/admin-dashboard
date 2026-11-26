// تنسيق الأرقام والتواريخ: أرقام إنجليزية + تقويم ميلادي
const LOCALE = "ar-SA-u-nu-latn-ca-gregory";
const TZ = "Asia/Riyadh"; // كل الأوقات بتوقيت السعودية

const money = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "SAR", maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat(LOCALE, { year: "numeric", month: "short", day: "numeric", timeZone: TZ });
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ,
});

type Num = number | string | { toString(): string } | null | undefined;

export function formatSAR(v: Num) {
  if (v === null || v === undefined || v === "") return "—";
  return money.format(Number(v.toString()));
}
export function formatDate(d?: Date | null) {
  return d ? date.format(d) : "—";
}
// تاريخ كامل باليوم: الخميس، 26 نوفمبر 2026
const dateLong = new Intl.DateTimeFormat(LOCALE, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: TZ });
export function formatDateLong(d: Date) {
  return dateLong.format(d);
}
// التاريخ الهجري (أم القرى) للخطابات الرسمية: 16 جمادى الآخرة 1448 هـ
const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { year: "numeric", month: "long", day: "numeric", timeZone: TZ });
export function formatHijri(d: Date) {
  return hijri.format(d);
}
const gregLong = new Intl.DateTimeFormat(LOCALE, { year: "numeric", month: "long", day: "numeric", timeZone: TZ });
export function formatDateFull(d: Date) {
  return gregLong.format(d);
}
export function formatDateTime(d: Date) {
  return dateTime.format(d);
}
export function txNumber(n: number) {
  return `TR-${String(n).padStart(4, "0")}`;
}
// قيمة تاريخ لحقل <input type="date">
export function dateInputValue(d?: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}
