import { CheckCircle2, Clock, LogIn, LogOut } from "lucide-react";
import { checkIn, checkOut } from "@/app/(dashboard)/employees/attendance-actions";
import { lateMinutes } from "@/lib/attendance";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getSchedule } from "@/lib/schedule";
import { isWeekend, minutesText, riyadhHM, riyadhToday } from "@/lib/time";

// بطاقة تسجيل الحضور والانصراف للموظف
export default async function AttendanceWidget({ employeeId }: { employeeId: string }) {
  const today = riyadhToday();
  const [r, s] = await Promise.all([
    db.attendance.findUnique({ where: { employeeId_date: { employeeId, date: today } } }),
    getSchedule(),
  ]);
  const late = r?.checkIn ? lateMinutes(r.checkIn, s) : 0;
  return (
    <div className="card p-5 flex flex-wrap items-center gap-5">
      <div className="size-12 rounded-2xl bg-navy-800 text-gold-300 flex items-center justify-center" aria-hidden="true"><Clock size={24} /></div>
      <div className="flex-1 min-w-48">
        <div className="font-semibold">حضوري اليوم — {formatDate(today)}</div>
        <div className="text-sm text-neutral-600">
          الدوام من <span dir="ltr">{s.start}</span> إلى <span dir="ltr">{s.end}</span>{isWeekend(today) && " · اليوم عطلة أسبوعية"}
        </div>
      </div>
      {r?.checkIn && (
        <div className="flex gap-6">
          <div>
            <div className="text-xs text-neutral-600">الحضور</div>
            <div dir="ltr" className="text-right text-xl font-bold tabular-nums">{riyadhHM(r.checkIn)}</div>
          </div>
          {r.checkOut && (
            <div>
              <div className="text-xs text-neutral-600">الانصراف</div>
              <div dir="ltr" className="text-right text-xl font-bold tabular-nums">{riyadhHM(r.checkOut)}</div>
            </div>
          )}
          <span className={`self-center rounded-full px-3 py-1 text-xs font-semibold ${late > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
            {late > 0 ? `تأخير ${minutesText(late)}` : "في الموعد"}
          </span>
        </div>
      )}
      {!r?.checkIn ? (
        <form action={checkIn}><button className="btn-primary !px-6 min-h-12 text-base"><LogIn size={18} /> تسجيل الحضور</button></form>
      ) : !r.checkOut ? (
        <form action={checkOut}><button className="inline-flex items-center gap-2 rounded-xl bg-navy-800 px-6 min-h-12 text-base font-semibold text-white hover:bg-navy-700"><LogOut size={18} /> تسجيل الانصراف</button></form>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-800 font-semibold"><CheckCircle2 size={18} /> تم تسجيل الحضور والانصراف</span>
      )}
    </div>
  );
}
