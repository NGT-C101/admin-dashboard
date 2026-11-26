import Link from "next/link";
import { AlertTriangle, BellRing, Building, CalendarClock, ClipboardList, Handshake, IdCard, Plane, Plus, UserCheck, Users } from "lucide-react";
import { getClientAlerts } from "@/lib/client-alerts";
import { getHrAlerts } from "@/lib/hr-alerts";
import AttendanceWidget from "@/components/AttendanceWidget";
import StageBadge from "@/components/ui/StageBadge";
import { riyadhToday } from "@/lib/time";
import { daysUntil, endOfToday } from "@/lib/clients";
import { can, canAccess, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateLong, txNumber } from "@/lib/format";
import { countText } from "@/lib/hr";
import { pendingForWhere } from "@/lib/leave";
import { SECTIONS, findSection } from "@/lib/nav";

// لون شريط المرحلة حسب ترتيبها في مسار المعاملة
const BAR_TONES = ["bg-brand-800", "bg-brand-600", "bg-clay", "bg-sky-700", "bg-emerald-700"];

export default async function HomePage() {
  const user = await requireUser();
  const open = { stage: { kind: "OPEN" as const } };
  const today = riyadhToday();
  const seeRequests = can(user, "requests");
  const manageHr = can(user, "employees", "MANAGE");
  const [clients, companies, openTx, overdueTx, myTx, clientAlerts, myFollowUps, staff, hrAlerts, onLeave, me,
    pendingApprovals, stageCounts, stages, myUpcoming, draftPayroll] = await Promise.all([
    db.client.count({ where: { archivedAt: null } }),
    db.company.count({ where: { client: { archivedAt: null } } }),
    db.transaction.count({ where: open }),
    db.transaction.count({ where: { ...open, dueDate: { lt: new Date() } } }),
    db.transaction.count({ where: { ...open, assigneeId: user.id } }),
    getClientAlerts(),
    db.interaction.count({ where: { assigneeId: user.id, followUpDone: false, followUpAt: { not: null, lte: endOfToday() } } }),
    db.employee.count({ where: { status: { not: "TERMINATED" } } }),
    getHrAlerts(),
    db.leaveRequest.count({ where: { kind: "LEAVE", status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } } }),
    user.employeeId ? db.employee.findUnique({ where: { id: user.employeeId }, select: { status: true } }) : null,
    db.leaveRequest.count({ where: pendingForWhere(user) }),
    seeRequests ? db.transaction.groupBy({ by: ["stageId"], where: open, _count: true }) : [],
    seeRequests ? db.stage.findMany({ where: { kind: "OPEN" }, orderBy: { order: "asc" }, select: { id: true, name: true } }) : [],
    seeRequests
      ? db.transaction.findMany({
          where: { ...open, assigneeId: user.id },
          orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { number: "asc" }],
          take: 5,
          select: {
            id: true, number: true, title: true, dueDate: true,
            company: { select: { name: true } }, govEntity: { select: { name: true } }, stage: { select: { name: true, kind: true } },
          },
        })
      : [],
    manageHr ? db.payrollRun.findFirst({ where: { status: "DRAFT" }, orderBy: { month: "desc" }, select: { month: true } }) : null,
  ]);

  const allStats = [
    { label: "معاملات جارية", value: openTx, icon: ClipboardList, href: "/requests/all", note: overdueTx > 0 ? `${overdueTx} متأخرة عن الموعد` : undefined },
    { label: "معاملات متأخرة", value: overdueTx, icon: AlertTriangle, href: "/requests/all?status=overdue", alert: overdueTx > 0 },
    { label: "معاملاتي الجارية", value: myTx, icon: UserCheck, href: "/requests/all?assignee=me" },
    { label: "العملاء", value: clients, icon: Handshake, href: "/clients/directory" },
    { label: "الشركات", value: companies, icon: Building, href: "/clients/companies" },
    { label: "تنبيهات العملاء", value: clientAlerts.counts.total, icon: BellRing, href: "/clients/alerts", alert: clientAlerts.counts.expired > 0 },
    { label: "متابعاتي المستحقة", value: myFollowUps, icon: CalendarClock, href: "/clients/communications", alert: myFollowUps > 0 },
    { label: "الموظفون الحاليون", value: staff, icon: Users, href: "/employees/profiles" },
    { label: "تنبيهات الموظفين", value: hrAlerts.length, icon: IdCard, href: "/employees/profiles", alert: hrAlerts.some((a) => a.date < new Date()) },
    { label: "في إجازة اليوم", value: onLeave, icon: Plane, href: "/employees/leaves?tab=away" },
  ];
  // كل رقم يظهر بس للي عنده صلاحية على القسم بتاعه
  const stats = allStats.filter((s) => canAccess(user, findSection(s.href.split("/")[1])!));

  // الأمور التي تحتاج إجراء — كل بند يظهر لصاحب الصلاحية وعند وجود عدد فقط
  const actions = [
    seeRequests && overdueTx > 0 && { tone: "rose", title: `${countText(overdueTx, ["معاملة واحدة متأخرة", "معاملتان متأخرتان", "معاملات متأخرة", "معاملة متأخرة"])} عن موعدها`, href: "/requests/all?status=overdue" },
    pendingApprovals > 0 && { tone: "amber", title: `${countText(pendingApprovals, ["طلب واحد", "طلبان", "طلبات", "طلباً"])} بانتظار موافقتك`, href: "/employees/leaves" },
    draftPayroll && { tone: "amber", title: `مسير رواتب ${draftPayroll.month} بانتظار الاعتماد`, href: "/employees/payroll" },
    can(user, "clients") && myFollowUps > 0 && { tone: "sky", title: `${countText(myFollowUps, ["متابعة واحدة مستحقة", "متابعتان مستحقتان", "متابعات مستحقة", "متابعة مستحقة"])} مع العملاء`, href: "/clients/communications" },
    can(user, "clients") && clientAlerts.counts.expired > 0 && { tone: "rose", title: `${countText(clientAlerts.counts.expired, ["عنصر واحد منتهي الصلاحية", "عنصران منتهيا الصلاحية", "عناصر منتهية الصلاحية", "عنصراً منتهي الصلاحية"])} في تنبيهات العملاء`, href: "/clients/alerts" },
    canAccess(user, findSection("employees")!) && hrAlerts.length > 0 && { tone: "amber", title: `${countText(hrAlerts.length, ["تنبيه واحد", "تنبيهان", "تنبيهات", "تنبيهاً"])} على وثائق الموظفين وعقودهم`, href: "/employees/profiles" },
  ].filter(Boolean) as { tone: "rose" | "amber" | "sky"; title: string; href: string }[];
  const TONE = { rose: "bg-rose-50 [--dot:var(--color-rose-700)]", amber: "bg-amber-50 [--dot:var(--color-amber-700)]", sky: "bg-sky-50 [--dot:var(--color-sky-700)]" };

  const countByStage = new Map(stageCounts.map((s) => [s.stageId, s._count]));
  // المراحل الفارغة لا تظهر حتى لا تطول القائمة
  const pipeline = stages.map((s) => ({ ...s, count: countByStage.get(s.id) ?? 0 })).filter((s) => s.count > 0);
  const maxCount = Math.max(1, ...pipeline.map((p) => p.count));

  const quick = [
    can(user, "requests", "EDIT") && { label: "معاملة جديدة", href: "/requests/all/new", primary: true },
    can(user, "clients", "EDIT") && { label: "العملاء", href: "/clients/directory" },
    user.employeeId && { label: "طلب إجازة", href: "/me" },
  ].filter(Boolean) as { label: string; href: string; primary?: boolean }[];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-clay">{formatDateLong(new Date())}</p>
          <h1 className="text-3xl font-extrabold leading-relaxed">أهلاً، {user.name}</h1>
          <p className="text-neutral-600">
            {actions.length > 0 ? `لديك ${countText(actions.length, ["أمر واحد يحتاج", "أمران يحتاجان", "أمور تحتاج", "أمراً يحتاج"])} إجراءً اليوم.` : "لا توجد أمور عاجلة اليوم."}
          </p>
        </div>
        {quick.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quick.map((q) => (
              <Link key={q.href} href={q.href} className={q.primary ? "btn-primary" : "btn-secondary"}>
                {q.primary && <Plus size={16} />} {q.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {user.employeeId && me && me.status !== "TERMINATED" && <AttendanceWidget employeeId={user.employeeId} />}

      {stats.length > 0 && <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, href, alert, note }, i) => {
          const featured = i === 0;
          return (
            <Link key={label} href={href}
              className={`rounded-2xl p-5 flex flex-col gap-1 transition ${
                featured ? "bg-brand-950 text-ivory hover:bg-brand-900" : "card hover:border-brand-600/40"
              }`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs sm:text-sm ${featured ? "text-sand" : "text-neutral-600"}`}>{label}</span>
                <Icon size={18} className={featured ? "text-sand" : alert ? "text-rose-700" : "text-clay"} aria-hidden="true" />
              </div>
              <span className={`stat-value ${!featured && alert ? "text-rose-700" : !featured ? "text-brand-950" : ""}`}>{value}</span>
              {note && <span className={`text-xs font-semibold ${featured ? "text-[#ffb4b4]" : "text-rose-700"}`}>{note}</span>}
            </Link>
          );
        })}
      </div>}

      {(pipeline.length > 0 || actions.length > 0) && (
        <div className="flex flex-wrap gap-4">
          {seeRequests && pipeline.length > 0 && (
            <section className="card p-6 flex-[7_1_460px] min-w-0 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-brand-950">المعاملات الجارية حسب المرحلة</h2>
                <Link href="/requests/tracking" className="link text-sm">لوحة المتابعة</Link>
              </div>
              <ul className="space-y-3">
                {pipeline.map((p, i) => (
                  <li key={p.id}>
                    <Link href={`/requests/all?stage=${p.id}`} className="flex items-center gap-3 rounded-lg py-1 hover:bg-neutral-50">
                      <span className="w-36 shrink-0 truncate text-sm">{p.name}</span>
                      <span className="flex-1 h-3 rounded-full bg-neutral-100">
                        <span className={`block h-3 rounded-full ${BAR_TONES[i % BAR_TONES.length]}`} style={{ width: `${(p.count / maxCount) * 100}%` }} />
                      </span>
                      <span className="w-8 text-left text-sm font-bold tabular-nums">{p.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-6 flex-[5_1_320px] min-w-0 space-y-3">
            <h2 className="text-lg font-bold text-brand-950">تحتاج إجراء</h2>
            {actions.length === 0 ? (
              <p className="text-sm text-neutral-600">لا توجد أمور عاجلة.</p>
            ) : (
              <ul className="space-y-2">
                {actions.map((a) => (
                  <li key={a.title}>
                    <Link href={a.href} className={`flex items-start gap-3 rounded-xl p-3 text-sm font-semibold hover:brightness-95 ${TONE[a.tone]}`}>
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--dot)]" aria-hidden="true" />
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {seeRequests && myUpcoming.length > 0 && (
        <section className="card p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-brand-950">معاملاتي القريبة</h2>
            <Link href="/requests/all?assignee=me" className="link text-sm">كل معاملاتي</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table min-w-[640px]">
              <thead>
                <tr><th>الرقم</th><th>المعاملة</th><th>الشركة</th><th>الجهة</th><th>الاستحقاق</th><th>المرحلة</th></tr>
              </thead>
              <tbody>
                {myUpcoming.map((t) => {
                  const d = t.dueDate ? daysUntil(t.dueDate) : null;
                  return (
                    <tr key={t.id} className="hover:bg-neutral-50">
                      <td dir="ltr" className="text-right font-semibold whitespace-nowrap"><Link href={`/requests/all/${t.id}`} className="link">{txNumber(t.number)}</Link></td>
                      <td>{t.title}</td>
                      <td className="text-neutral-600">{t.company.name}</td>
                      <td className="text-neutral-600">{t.govEntity?.name ?? "—"}</td>
                      <td className={d !== null && d < 0 ? "font-semibold text-rose-700" : ""}>{formatDate(t.dueDate)}</td>
                      <td><StageBadge name={t.stage.name} kind={t.stage.kind} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-brand-950">الأقسام</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.filter((s) => canAccess(user, s)).map((s) => (
            <div key={s.slug} className="card p-5">
              <h3 className="font-semibold mb-3">{s.title}</h3>
              <div className="flex flex-wrap gap-2">
                {s.subs.map((sub) => (
                  <Link
                    key={sub.slug}
                    href={`/${s.slug}/${sub.slug}`}
                    className="text-xs rounded-full bg-neutral-100 px-3 py-1.5 text-neutral-700 hover:bg-brand-50 hover:text-brand-800"
                  >
                    {sub.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
