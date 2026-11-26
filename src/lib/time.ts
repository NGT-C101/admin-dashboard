// التواريخ والأوقات بتوقيت السعودية (UTC+3 طول السنة، مفيش توقيت صيفي)
const OFFSET = 3 * 3600000;
export const DAY_MS = 86400000;

// "اليوم" بتوقيت السعودية كتاريخ (منتصف الليل UTC) — مناسب لحقول @db.Date
export function riyadhToday(now = new Date()) {
  const d = new Date(now.getTime() + OFFSET);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
export function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function parseDateKey(s: string) {
  return new Date(`${s}T00:00:00Z`);
}
// الساعة والدقيقة بتوقيت السعودية لوقت معيّن
export function riyadhHM(d: Date) {
  const r = new Date(d.getTime() + OFFSET);
  return `${String(r.getUTCHours()).padStart(2, "0")}:${String(r.getUTCMinutes()).padStart(2, "0")}`;
}
export function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
// وقت (HH:MM) في يوم معيّن بتوقيت السعودية → Date حقيقي
export function riyadhDateTime(day: Date, hm: string) {
  return new Date(day.getTime() + hmToMinutes(hm) * 60000 - OFFSET);
}
// الجمعة والسبت عطلة نهاية الأسبوع
export function isWeekend(day: Date) {
  const w = day.getUTCDay();
  return w === 5 || w === 6;
}
export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}
export function currentMonthKey() {
  return dateKey(riyadhToday()).slice(0, 7);
}
export function minutesText(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h} س` : "", m ? `${m} د` : ""].filter(Boolean).join(" ") || "0 د";
}
