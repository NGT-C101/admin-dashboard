"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSection, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalText } from "@/lib/forms";
import { saveSchedule } from "@/lib/schedule";
import { hmToMinutes, parseDateKey, riyadhDateTime, riyadhToday } from "@/lib/time";

function revalidateAll() {
  revalidatePath("/me");
  revalidatePath("/employees/attendance");
  revalidatePath("/");
}

async function myActiveEmployee() {
  const user = await requireUser();
  if (!user.employeeId) return null;
  const e = await db.employee.findUnique({ where: { id: user.employeeId } });
  return e && e.status !== "TERMINATED" ? e : null;
}

// تسجيل الحضور: الوقت من السيرفر (مش من جهاز الموظف)
export async function checkIn() {
  const e = await myActiveEmployee();
  if (!e) return;
  const date = riyadhToday();
  const existing = await db.attendance.findUnique({ where: { employeeId_date: { employeeId: e.id, date } } });
  if (existing?.checkIn) return;
  await db.attendance.upsert({
    where: { employeeId_date: { employeeId: e.id, date } },
    update: { checkIn: new Date() }, create: { employeeId: e.id, date, checkIn: new Date() },
  });
  revalidateAll();
}

export async function checkOut() {
  const e = await myActiveEmployee();
  if (!e) return;
  const date = riyadhToday();
  const r = await db.attendance.findUnique({ where: { employeeId_date: { employeeId: e.id, date } } });
  if (!r?.checkIn) return;
  await db.attendance.update({ where: { id: r.id }, data: { checkOut: new Date() } });
  revalidateAll();
}

const hm = z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).transform((v) => v || null);
const manualSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "يرجى تحديد التاريخ"),
  checkIn: hm,
  checkOut: hm,
  note: optionalText,
}).refine((d) => !d.checkOut || d.checkIn, { message: "يرجى إدخال وقت الحضور" })
  .refine((d) => !d.checkOut || !d.checkIn || hmToMinutes(d.checkOut) > hmToMinutes(d.checkIn), { message: "يجب أن يكون الانصراف بعد الحضور" });

// تعديل يدوي (نسيان البصمة مثلاً) — يُسجّل مين عدّل
export async function saveAttendance(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSection("employees", "EDIT");
  const p = manualSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: firstError(p.error) };
  const date = parseDateKey(p.data.date);
  if (date > riyadhToday()) return { error: "لا يمكن تسجيل حضور ليوم لم يأتِ بعد" };
  const where = { employeeId_date: { employeeId: p.data.employeeId, date } };
  if (!p.data.checkIn) {
    await db.attendance.deleteMany({ where: { employeeId: p.data.employeeId, date } });
  } else {
    const data = {
      checkIn: riyadhDateTime(date, p.data.checkIn), checkOut: p.data.checkOut ? riyadhDateTime(date, p.data.checkOut) : null,
      note: p.data.note, source: "MANUAL", editedById: user.id,
    };
    await db.attendance.upsert({ where, update: data, create: { employeeId: p.data.employeeId, date, ...data } });
  }
  revalidateAll();
  return { success: "تم الحفظ" };
}

const scheduleSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/),
  grace: z.coerce.number().int().min(0).max(120),
}).refine((d) => hmToMinutes(d.end) > hmToMinutes(d.start), { message: "يجب أن تكون نهاية الدوام بعد بدايته" });

export async function updateSchedule(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("employees", "MANAGE");
  const p = scheduleSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: firstError(p.error) };
  await saveSchedule(p.data);
  revalidateAll();
  return { success: "تم حفظ مواعيد الدوام" };
}

const holidaySchema = z.object({
  name: z.string().trim().min(2, "يرجى إدخال اسم العطلة"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "يرجى تحديد البداية").transform(parseDateKey),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "يرجى تحديد النهاية").transform(parseDateKey),
}).refine((d) => d.endDate >= d.startDate, { message: "يجب ألا تسبق النهاية البداية" });

export async function addHoliday(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("employees", "MANAGE");
  const p = holidaySchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: firstError(p.error) };
  await db.holiday.create({ data: p.data });
  revalidateAll();
  return { success: "تمت إضافة العطلة" };
}

export async function deleteHoliday(formData: FormData) {
  await requireSection("employees", "MANAGE");
  await db.holiday.deleteMany({ where: { id: String(formData.get("id")) } });
  revalidateAll();
}
