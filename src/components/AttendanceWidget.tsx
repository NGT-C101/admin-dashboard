import { Clock, LogIn, LogOut } from "lucide-react";
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
      <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center"><Clock size={24} /></div>
      <div className="flex-1 min-w-48">
        <div className="font-semibold">الحضور اليوم — {formatDate(today)}</div>
        <div className="text-sm text-neutral-600">
          الدوام من {s.start} إلى {s.end}{isWeekend(today) && " · اليوم عطلة أسبوعية"}
        </div>
        {r?.checkIn && (
          <div className="text-sm mt-1">
            الحضور: <b dir="ltr">{riyadhHM(r.checkIn)}</b>
            {late > 0 && <span className="text-amber-700"> (تأخير {minutesText(late)})</span>}
            {r.checkOut && <> · الانصراف: <b dir="ltr">{riyadhHM(r.checkOut)}</b></>}
          </div>
        )}
      </div>
      {!r?.checkIn ? (
        <form action={checkIn}><button className="btn-primary !px-6 !py-3 text-base"><LogIn size={18} /> تسجيل الحضور</button></form>
      ) : !r.checkOut ? (
        <form action={checkOut}><button className="btn-secondary !px-6 !py-3 text-base"><LogOut size={18} /> تسجيل الانصراف</button></form>
      ) : (
        <span className="text-sm text-emerald-700 font-medium">✅ تم تسجيل الحضور والانصراف</span>
      )}
    </div>
  );
}
