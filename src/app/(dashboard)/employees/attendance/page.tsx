import Link from "next/link";
import { FileDown, Trash2 } from "lucide-react";
import EmployeeAvatar from "@/components/EmployeeAvatar";
import ActionForm from "@/components/ui/ActionForm";
import { Field, FieldGrid } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { can, requireSection } from "@/lib/auth";
import { attendanceData, dayState, monthSummary } from "@/lib/attendance";
import { db } from "@/lib/db";
import { getSchedule } from "@/lib/schedule";
import { formatDate } from "@/lib/format";
import { DAY_MS, currentMonthKey, dateKey, minutesText, monthBounds, parseDateKey, riyadhHM, riyadhToday } from "@/lib/time";
import { addHoliday, deleteHoliday, saveAttendance, updateSchedule } from "../attendance-actions";

const STATE_STYLE: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 ring-emerald-200", absent: "bg-rose-50 text-rose-700 ring-rose-200",
  leave: "bg-sky-50 text-sky-700 ring-sky-200", holiday: "bg-violet-50 text-violet-700 ring-violet-200",
  weekend: "bg-neutral-100 text-neutral-500 ring-neutral-200", "not-yet": "bg-amber-50 text-amber-700 ring-amber-200",
  future: "bg-neutral-50 text-neutral-400 ring-neutral-200", "before-hire": "bg-neutral-50 text-neutral-400 ring-neutral-200",
};

type SP = { tab?: string; date?: string; month?: string };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("employees");
  const sp = await searchParams;
  const canEdit = can(user, "employees", "EDIT");
  const canManage = can(user, "employees", "MANAGE");
  const tabs = [{ key: "daily", label: "الحضور اليومي" }, { key: "monthly", label: "التقرير الشهري" }, ...(canManage ? [{ key: "settings", label: "مواعيد الدوام والعطلات" }] : [])];
  const tab = tabs.some((t) => t.key === sp.tab) ? sp.tab! : "daily";
  const emps = await db.employee.findMany({
    where: { status: { not: "TERMINATED" } }, orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, jobTitle: true, hireDate: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="الحضور والانصراف" crumbs={[{ label: "الموظفين", href: "/employees/profiles" }, { label: "الحضور والانصراف" }]} />
      <Tabs base="/employees/attendance" current={tab} tabs={tabs} />
      {tab === "daily" && <Daily />}
      {tab === "monthly" && <Monthly />}
      {tab === "settings" && canManage && <Settings />}
    </div>
  );

  async function Daily() {
    const today = riyadhToday();
    const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? parseDateKey(sp.date!) : today;
    const data = await attendanceData(emps.map((e) => e.id), day, day);
    const rows = emps.map((e) => ({ e, st: dayState({ day, hireDate: e.hireDate, today: data.today, schedule: data.schedule, holidays: data.holidays,
      record: data.rec.get(`${e.id}|${dateKey(day)}`), leave: data.leaveOn(e.id, day), trackingStart: data.trackingStart }) }));
    const count = (k: string) => rows.filter((r) => r.st.kind === k).length;
    const late = rows.filter((r) => r.st.kind === "present" && r.st.late > 0).length;
    const nav = (d: number) => `?date=${dateKey(new Date(day.getTime() + d * DAY_MS))}`;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={nav(-1)} className="btn-secondary !py-1.5">→ اليوم السابق</Link>
          <form className="flex gap-2"><input type="date" name="date" defaultValue={dateKey(day)} className="input w-auto" /><button className="btn-secondary !py-1.5">عرض</button></form>
          {day < today && <Link href={nav(1)} className="btn-secondary !py-1.5">اليوم التالي ←</Link>}
          <span className="text-sm text-neutral-600 mr-2">{formatDate(day)} · الدوام {data.schedule.start} – {data.schedule.end}</span>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-5 text-center">
          {[["حاضر", count("present"), "text-emerald-700"], ["متأخر", late, "text-amber-600"], ["في إجازة", count("leave"), "text-sky-700"],
            ["غائب", count("absent"), "text-rose-600"], ["لم يسجّل بعد", count("not-yet"), "text-neutral-600"]].map(([l, v, c]) => (
            <div key={l as string} className="card p-3"><div className={`text-2xl font-bold ${c}`}>{v}</div><div className="text-xs text-neutral-500">{l}</div></div>
          ))}
        </div>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>الموظف</th><th>الحالة</th><th>الحضور</th><th>الانصراف</th><th>التأخير</th>{canEdit && <th>تعديل يدوي</th>}</tr></thead>
            <tbody>
              {rows.map(({ e, st }) => {
                const rec = st.kind === "present" ? st.record : undefined;
                return (
                  <tr key={e.id}>
                    <td><div className="flex items-center gap-2"><EmployeeAvatar name={e.fullName} size="sm" />
                      <div><Link href={`/employees/profiles/${e.id}`} className="font-medium hover:underline">{e.fullName}</Link><div className="text-xs text-neutral-500">{e.jobTitle}</div></div></div></td>
                    <td><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs ring-1 ${STATE_STYLE[st.kind]}`}>{st.label}</span>
                      {rec?.source === "MANUAL" && <div className="text-[10px] text-neutral-400 mt-0.5">معدّل يدوياً{rec.note ? `: ${rec.note}` : ""}</div>}</td>
                    <td dir="ltr" className="text-right">{st.kind === "present" ? st.checkIn : "—"}</td>
                    <td dir="ltr" className="text-right">{st.kind === "present" ? st.checkOut ?? "—" : "—"}</td>
                    <td className={st.kind === "present" && st.late ? "text-amber-700 font-medium" : "text-neutral-400"}>{st.kind === "present" && st.late ? minutesText(st.late) : "—"}</td>
                    {canEdit && (
                      <td>
                        {day <= today && (
                          <ActionForm action={saveAttendance} submitLabel="حفظ" resetOnSuccess={false} className="flex items-center gap-1">
                            <input type="hidden" name="employeeId" value={e.id} /><input type="hidden" name="date" value={dateKey(day)} />
                            <input type="time" name="checkIn" defaultValue={rec?.checkIn ? riyadhHM(rec.checkIn) : ""} className="input !py-1 w-28" aria-label="الحضور" />
                            <input type="time" name="checkOut" defaultValue={rec?.checkOut ? riyadhHM(rec.checkOut) : ""} className="input !py-1 w-28" aria-label="الانصراف" />
                            <input name="note" placeholder="سبب التعديل" defaultValue={rec?.note ?? ""} className="input !py-1 w-32" />
                          </ActionForm>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={6} className="text-center text-neutral-500 py-8">لا يوجد موظفون</td></tr>}
            </tbody>
          </table>
        </div>
        {canEdit && <p className="text-xs text-neutral-500">💡 لحذف تسجيل حضور: امسح وقت الحضور واضغط حفظ. كل تعديل يدوي يُسجّل باسم من قام به.</p>}
      </div>
    );
  }

  async function Monthly() {
    const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonthKey();
    const { start, end } = monthBounds(month);
    const last = new Date(end.getTime() - DAY_MS);
    const data = await attendanceData(emps.map((e) => e.id), start, last);
    const rows = emps.map((e) => ({ e, s: monthSummary(e, start, last, data) }));
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <form className="flex items-end gap-2"><input type="hidden" name="tab" value="monthly" />
            <input type="month" name="month" defaultValue={month} className="input w-auto" /><button className="btn-secondary">عرض</button></form>
          {/* تحميل ملف: لازم رابط عادي مش تنقّل بين الصفحات */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href={`/api/export/attendance?month=${month}`} className="btn-secondary"><FileDown size={16} /> تصدير Excel</a>
        </div>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>الموظف</th><th>أيام العمل</th><th>حضور</th><th>إجازة</th><th>غياب</th><th>مرات التأخير</th><th>إجمالي التأخير</th><th>نسبة الالتزام</th></tr></thead>
            <tbody>
              {rows.map(({ e, s }) => {
                const rate = s.workdays ? Math.round(((s.present + s.leave) / s.workdays) * 100) : null;
                return (
                  <tr key={e.id}>
                    <td><Link href={`/employees/profiles/${e.id}?tab=leave`} className="link">{e.fullName}</Link></td>
                    <td>{s.workdays}</td><td className="text-emerald-700">{s.present}</td><td className="text-sky-700">{s.leave}</td>
                    <td className={s.absent ? "text-rose-600 font-semibold" : ""}>{s.absent}</td><td>{s.lateCount}</td>
                    <td className={s.lateMinutes ? "text-amber-700" : ""}>{minutesText(s.lateMinutes)}</td>
                    <td>{rate === null ? "—" : (
                      <div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-neutral-200 overflow-hidden">
                        <div className={`h-full ${rate >= 95 ? "bg-emerald-600" : rate >= 85 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${rate}%` }} /></div>{rate}%</div>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  async function Settings() {
    const [s, holidays] = await Promise.all([getSchedule(), db.holiday.findMany({ where: { endDate: { gte: new Date(Date.UTC(new Date().getUTCFullYear() - 1, 0, 1)) } }, orderBy: { startDate: "asc" } })]);
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">مواعيد الدوام</h2>
          <p className="text-xs text-neutral-500">أيام العمل من الأحد إلى الخميس. يُحتسب التأخير بعد انقضاء دقائق السماح.</p>
          <ActionForm action={updateSchedule} submitLabel="حفظ" resetOnSuccess={false}>
            <FieldGrid>
              <Field label="بداية الدوام"><input type="time" name="start" defaultValue={s.start} required className="input" /></Field>
              <Field label="نهاية الدوام"><input type="time" name="end" defaultValue={s.end} required className="input" /></Field>
              <Field label="دقائق السماح"><input type="number" name="grace" min={0} max={120} defaultValue={s.grace} className="input" /></Field>
            </FieldGrid>
          </ActionForm>
        </section>
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">العطلات الرسمية</h2>
          <p className="text-xs text-neutral-500">لا تُحتسب ضمن أيام الإجازة ولا الغياب. تُضاف إجازتا عيد الفطر وعيد الأضحى سنوياً حسب الإعلان الرسمي.</p>
          <ul className="divide-y divide-neutral-100 text-sm">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-2">
                <span><b>{h.name}</b> <span className="text-neutral-500">· {formatDate(h.startDate)}{h.endDate > h.startDate && ` ← ${formatDate(h.endDate)}`}</span></span>
                <form action={deleteHoliday}><input type="hidden" name="id" value={h.id} /><button className="text-rose-600" title="حذف"><Trash2 size={15} /></button></form>
              </li>
            ))}
          </ul>
          <ActionForm action={addHoliday} submitLabel="إضافة عطلة">
            <FieldGrid>
              <Field label="الاسم"><input name="name" required placeholder="مثال: إجازة عيد الفطر" className="input" /></Field>
              <Field label="من"><input type="date" name="startDate" required className="input" /></Field>
              <Field label="إلى"><input type="date" name="endDate" required className="input" /></Field>
            </FieldGrid>
          </ActionForm>
        </section>
      </div>
    );
  }
}
