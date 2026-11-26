import { attendanceData, dayState, monthSummary } from "@/lib/attendance";
import { DAY_MS, minutesText, monthBounds } from "@/lib/time";

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const STYLE: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-800", absent: "bg-rose-50 text-rose-700", leave: "bg-sky-50 text-sky-800",
  holiday: "bg-violet-50 text-violet-700", weekend: "bg-neutral-50 text-neutral-400", "not-yet": "bg-amber-50 text-amber-700",
  future: "text-neutral-300", "before-hire": "text-neutral-300",
};

// تقويم حضور شهر لموظف
export default async function MonthAttendance({ employee, month }: { employee: { id: string; hireDate: Date }; month: string }) {
  const { start, end } = monthBounds(month);
  const last = new Date(end.getTime() - DAY_MS);
  const data = await attendanceData([employee.id], start, last);
  const sum = monthSummary(employee, start, last, data);
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < start.getUTCDay(); i++) cells.push(<div key={`p${i}`} />);
  for (let t = start.getTime(); t <= last.getTime(); t += DAY_MS) {
    const day = new Date(t);
    const st = dayState({ day, hireDate: employee.hireDate, today: data.today, schedule: data.schedule, holidays: data.holidays,
      record: data.rec.get(`${employee.id}|${day.toISOString().slice(0, 10)}`), leave: data.leaveOn(employee.id, day), trackingStart: data.trackingStart });
    cells.push(
      <div key={t} className={`rounded-lg p-1.5 min-h-16 text-[11px] leading-tight ${STYLE[st.kind]} ${day.getTime() === data.today.getTime() ? "ring-2 ring-brand-600" : ""}`}>
        <div className="font-bold text-xs">{day.getUTCDate()}</div>
        {st.kind === "present" ? (
          <div dir="ltr" className="text-right">{st.checkIn}{st.checkOut ? `–${st.checkOut}` : ""}{st.late > 0 && <div className="text-amber-700" dir="rtl">تأخير {minutesText(st.late)}</div>}</div>
        ) : !["future", "before-hire", "weekend"].includes(st.kind) && <div>{st.label}</div>}
      </div>,
    );
  }
  return (
    <div className="card p-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-sm">
        {[["أيام العمل", sum.workdays], ["حضور", sum.present], ["إجازة", sum.leave], ["غياب", sum.absent], ["تأخير", `${sum.lateCount} (${minutesText(sum.lateMinutes)})`]].map(([l, v]) => (
          <div key={l as string} className="rounded-lg bg-neutral-50 p-2"><div className="font-bold">{v}</div><div className="text-xs text-neutral-500">{l}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => <div key={w} className="text-center text-xs text-neutral-500 pb-1">{w}</div>)}
        {cells}
      </div>
    </div>
  );
}
