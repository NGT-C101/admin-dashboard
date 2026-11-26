import "server-only";
import type { Attendance, LeaveRequest } from "@prisma/client";
import { db } from "./db";
import { holidaySet, LEAVE_TYPE_LABELS } from "./leave";
import { getSchedule, type WorkSchedule } from "./schedule";
import { DAY_MS, dateKey, hmToMinutes, isWeekend, riyadhHM, riyadhToday } from "./time";

export type DayState =
  | { kind: "weekend" | "holiday" | "future" | "before-hire"; label: string }
  | { kind: "leave"; label: string }
  | { kind: "present"; label: string; checkIn: string; checkOut?: string; late: number; record: Attendance }
  | { kind: "absent" | "not-yet"; label: string };

export function lateMinutes(checkIn: Date, s: WorkSchedule) {
  const m = hmToMinutes(riyadhHM(checkIn)) - hmToMinutes(s.start);
  return m > s.grace ? m : 0;
}

// حالة موظف في يوم معيّن
export function dayState(args: {
  day: Date; hireDate: Date; today: Date; schedule: WorkSchedule; holidays: Set<string>;
  record?: Attendance; leave?: Pick<LeaveRequest, "type">;
  trackingStart?: Date | null; // أول يوم اتسجّل فيه حضور على المنصة — قبله مفيش غياب
}): DayState {
  const { day, hireDate, today, schedule, holidays, record, leave, trackingStart } = args;
  if (record?.checkIn) {
    return {
      kind: "present", label: "حاضر", checkIn: riyadhHM(record.checkIn),
      checkOut: record.checkOut ? riyadhHM(record.checkOut) : undefined, late: lateMinutes(record.checkIn, schedule), record,
    };
  }
  if (day < new Date(Date.UTC(hireDate.getUTCFullYear(), hireDate.getUTCMonth(), hireDate.getUTCDate()))) return { kind: "before-hire", label: "—" };
  if (isWeekend(day)) return { kind: "weekend", label: "عطلة أسبوعية" };
  if (holidays.has(dateKey(day))) return { kind: "holiday", label: "عطلة رسمية" };
  if (leave) return { kind: "leave", label: leave.type ? LEAVE_TYPE_LABELS[leave.type] : "إجازة" };
  if (day > today) return { kind: "future", label: "—" };
  if (day.getTime() === today.getTime()) return { kind: "not-yet", label: "لم يسجّل بعد" };
  if (!trackingStart || day < trackingStart) return { kind: "before-hire", label: "—" };
  return { kind: "absent", label: "غائب" };
}

// بيانات الحضور لمجموعة موظفين في فترة
export async function attendanceData(employeeIds: string[], from: Date, to: Date) {
  const [records, leaves, holidays, schedule, first] = await Promise.all([
    db.attendance.findMany({ where: { employeeId: { in: employeeIds }, date: { gte: from, lte: to } } }),
    db.leaveRequest.findMany({
      where: { employeeId: { in: employeeIds }, kind: "LEAVE", status: "APPROVED", startDate: { lte: to }, endDate: { gte: from } },
      select: { employeeId: true, type: true, startDate: true, endDate: true },
    }),
    holidaySet(from, to),
    getSchedule(),
    db.attendance.aggregate({ _min: { date: true } }),
  ]);
  const rec = new Map(records.map((r) => [`${r.employeeId}|${dateKey(r.date)}`, r]));
  const leaveOn = (employeeId: string, day: Date) =>
    leaves.find((l) => l.employeeId === employeeId && l.startDate <= day && l.endDate >= day);
  return { rec, leaveOn, holidays, schedule, today: riyadhToday(), trackingStart: first._min.date };
}

// ملخص شهري لموظف
export function monthSummary(
  e: { id: string; hireDate: Date },
  from: Date, to: Date,
  data: Awaited<ReturnType<typeof attendanceData>>,
) {
  const s = { workdays: 0, present: 0, absent: 0, leave: 0, lateCount: 0, lateMinutes: 0 };
  // الملخص لحد النهارده بس (الإجازات المستقبلية بتظهر في التقويم ومش بتتحسب)
  const until = Math.min(to.getTime(), data.today.getTime());
  for (let t = from.getTime(); t <= until; t += DAY_MS) {
    const day = new Date(t);
    const st = dayState({ day, hireDate: e.hireDate, today: data.today, schedule: data.schedule, holidays: data.holidays,
      record: data.rec.get(`${e.id}|${dateKey(day)}`), leave: data.leaveOn(e.id, day), trackingStart: data.trackingStart });
    if (["weekend", "holiday", "future", "before-hire", "not-yet"].includes(st.kind)) continue;
    s.workdays++;
    if (st.kind === "present") { s.present++; if (st.late) { s.lateCount++; s.lateMinutes += st.late; } }
    else if (st.kind === "leave") s.leave++;
    else if (st.kind === "absent") s.absent++;
  }
  return s;
}
