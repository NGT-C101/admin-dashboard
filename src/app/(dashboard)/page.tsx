import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, BellRing, Building, CalendarClock, ClipboardList, FolderOpen, Handshake, IdCard, Megaphone, Plane, Plus, Settings, UserCheck, Users, Wallet,
} from "lucide-react";
import { getClientAlerts } from "@/lib/client-alerts";
import { getHrAlerts } from "@/lib/hr-alerts";
import AttendanceWidget from "@/components/AttendanceWidget";
import MonthlyChart, { type MonthPoint } from "@/components/MonthlyChart";
import Image from "next/image";
import { GREGORIAN_MONTHS, currentMonthKey, dateKey, monthBounds, riyadhHM, riyadhToday } from "@/lib/time";
import { daysUntil, endOfToday } from "@/lib/clients";
import { can, canAccess, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { formatDate, formatDateLong, formatHijri, txNumber } from "@/lib/format";
import { countText } from "@/lib/hr";
import { pendingForWhere } from "@/lib/leave";
import { awaitingDeliveryWhere } from "@/lib/deliveries";
import { myQueueWhere } from "@/lib/letters";
import { purchaseQueueWhere } from "@/lib/purchases";
import { awaitingAcceptanceWhere, decidableExtensionsWhere, visibleTxWhere } from "@/lib/transactions";
import { SECTIONS, findSection } from "@/lib/nav";

// لون مربع الأيقونة ثابت لكل مؤشر (اللون يتبع المؤشر لا ترتيبه)
const TILE = {
  violet: "from-violet-400 to-indigo-700",
  rose: "from-rose-400 to-rose-700",
  blue: "from-sky-400 to-blue-700",
  green: "from-emerald-400 to-emerald-700",
  gold: "from-gold-300 to-gold-600",
  teal: "from-teal-300 to-teal-700",
} as const;

const SECTION_ICONS = { users: Users, handshake: Handshake, clipboard: ClipboardList, folder: FolderOpen, wallet: Wallet, megaphone: Megaphone };

// آخر 12 شهراً بمفاتيح YYYY-MM (الأقدم أولاً)
function lastMonths(n: number) {
  const [y, m] = currentMonthKey().split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}
const monthOf = (d: Date) => dateKey(riyadhToday(d)).slice(0, 7);

export default async function HomePage() {
  const user = await requireUser();
  const open = { stage: { kind: "OPEN" as const } };
  const today = riyadhToday();
  const seeRequests = can(user, "requests");
  const manageHr = can(user, "employees", "MANAGE");
  const months = lastMonths(12);
  const since = monthBounds(months[0]).start;

  const [clients, companies, openTx, overdueTx, myTx, clientAlerts, myFollowUps, staff, hrAlerts, onLeave, me,
    pendingApprovals, myUpcoming, draftPayroll, recent, doneTx, cancelledTx, createdRows, doneEvents, awaitingDelivery, toAccept, toDecide, lettersQueue, lettersAssigned, myCustodyAck, purchaseQueue] = await Promise.all([
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
    seeRequests
      ? db.transaction.findMany({
          where: { ...open, assigneeId: user.id },
          orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { number: "asc" }],
          // معاملاتي: تظهر حتى لو كانت سرية لأنني المسؤول عنها
          take: 5,
          select: { id: true, number: true, title: true, dueDate: true, company: { select: { name: true } } },
        })
      : [],
    manageHr ? db.payrollRun.findFirst({ where: { status: "DRAFT" }, orderBy: { month: "desc" }, select: { month: true } }) : null,
    seeRequests
      ? db.transaction.findMany({
          where: visibleTxWhere(user),
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true, number: true, title: true, dueDate: true, updatedAt: true,
            company: { select: { name: true } }, stage: { select: { name: true, kind: true } },
          },
        })
      : [],
    seeRequests ? db.transaction.count({ where: { stage: { kind: "DONE" } } }) : 0,
    seeRequests ? db.transaction.count({ where: { stage: { kind: "CANCELLED" } } }) : 0,
    seeRequests ? db.transaction.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }) : [],
    seeRequests
      ? db.transactionEvent.findMany({ where: { createdAt: { gte: since }, stage: { kind: "DONE" } }, select: { transactionId: true, createdAt: true } })
      : [],
    seeRequests ? db.transaction.count({ where: awaitingDeliveryWhere }) : 0,
    seeRequests ? db.transaction.count({ where: awaitingAcceptanceWhere(user.id) }) : 0,
    seeRequests ? db.extensionRequest.count({ where: decidableExtensionsWhere(user) }) : 0,
    can(user, "admin-affairs") ? db.letter.count({ where: myQueueWhere(user) }) : 0,
    can(user, "admin-affairs") ? db.letter.count({ where: { direction: "INCOMING", status: "RECEIVED", assigneeId: user.id, actionDone: false } }) : 0,
    user.employeeId ? db.custody.count({ where: { employeeId: user.employeeId, status: "PENDING" } }) : 0,
    db.purchaseRequest.count({ where: purchaseQueueWhere(user) }),
  ]);

  const allStats = [
    { label: "معاملات جارية", value: openTx, icon: ClipboardList, href: "/requests/all", tile: TILE.violet },
    { label: "معاملات متأخرة", value: overdueTx, icon: AlertTriangle, href: "/requests/all?status=overdue", tile: TILE.rose, alert: overdueTx > 0 },
    { label: "معاملاتي الجارية", value: myTx, icon: UserCheck, href: "/requests/all?assignee=me", tile: TILE.blue },
    { label: "العملاء", value: clients, icon: Handshake, href: "/clients/directory", tile: TILE.green },
    { label: "الشركات", value: companies, icon: Building, href: "/clients/companies", tile: TILE.gold },
    { label: "تنبيهات العملاء", value: clientAlerts.counts.total, icon: BellRing, href: "/clients/alerts", tile: TILE.rose, alert: clientAlerts.counts.expired > 0 },
    { label: "متابعاتي المستحقة", value: myFollowUps, icon: CalendarClock, href: "/clients/communications", tile: TILE.teal, alert: myFollowUps > 0 },
    { label: "الموظفون الحاليون", value: staff, icon: Users, href: "/employees/profiles", tile: TILE.blue },
    { label: "تنبيهات الموظفين", value: hrAlerts.length, icon: IdCard, href: "/employees/profiles", tile: TILE.gold, alert: hrAlerts.some((a) => a.date < new Date()) },
    { label: "في إجازة اليوم", value: onLeave, icon: Plane, href: "/employees/leaves?tab=away", tile: TILE.teal },
  ];
  // كل رقم يظهر بس للي عنده صلاحية على القسم بتاعه
  const stats = allStats.filter((s) => canAccess(user, findSection(s.href.split("/")[1])!));

  // الأمور التي تحتاج إجراء — كل بند يظهر لصاحب الصلاحية وعند وجود عدد فقط
  const actions = [
    seeRequests && overdueTx > 0 && { tone: "rose", title: `${countText(overdueTx, ["معاملة واحدة متأخرة", "معاملتان متأخرتان", "معاملات متأخرة", "معاملة متأخرة"])} عن موعدها`, href: "/requests/all?status=overdue" },
    seeRequests && toAccept > 0 && { tone: "amber", title: `${countText(toAccept, ["معاملة واحدة مسندة", "معاملتان مسندتان", "معاملات مسندة", "معاملة مسندة"])} إليك بانتظار استلامك بتعهد`, href: "/requests/all?status=accept" },
    seeRequests && toDecide > 0 && { tone: "sky", title: `${countText(toDecide, ["طلب تأجيل واحد", "طلبا تأجيل", "طلبات تأجيل", "طلب تأجيل"])} بانتظار قرارك`, href: "/requests/all?status=extension" },
    purchaseQueue > 0 && { tone: "amber", title: `${countText(purchaseQueue, ["طلب شراء واحد", "طلبا شراء", "طلبات شراء", "طلب شراء"])} بانتظار إجرائك`, href: can(user, "admin-affairs") ? "/admin-affairs/procurement?tab=queue" : "/admin-affairs/procurement/mine" },
    myCustodyAck > 0 && { tone: "amber", title: `${countText(myCustodyAck, ["عهدة واحدة", "عهدتان", "عُهد", "عهدة"])} بانتظار إقرارك بالاستلام`, href: "/me" },
    lettersQueue > 0 && { tone: "amber", title: `${countText(lettersQueue, ["خطاب واحد", "خطابان", "خطابات", "خطاباً"])} بانتظار مراجعتك أو اعتمادك`, href: "/admin-affairs/correspondence?tab=queue" },
    lettersAssigned > 0 && { tone: "sky", title: `${countText(lettersAssigned, ["خطاب وارد واحد محال", "خطابان واردان محالان", "خطابات واردة محالة", "خطاباً وارداً محالاً"])} إليك`, href: "/admin-affairs/correspondence?tab=in&status=assigned" },
    seeRequests && awaitingDelivery > 0 && { tone: "amber", title: `${countText(awaitingDelivery, ["معاملة واحدة", "معاملتان", "معاملات", "معاملة"])} بانتظار تسليم المخرجات للعميل`, href: "/requests/deliverables" },
    pendingApprovals > 0 && { tone: "amber", title: `${countText(pendingApprovals, ["طلب واحد", "طلبان", "طلبات", "طلباً"])} بانتظار موافقتك`, href: "/employees/leaves" },
    draftPayroll && { tone: "amber", title: `مسير رواتب ${draftPayroll.month} بانتظار الاعتماد`, href: "/employees/payroll" },
    can(user, "clients") && myFollowUps > 0 && { tone: "sky", title: `${countText(myFollowUps, ["متابعة واحدة مستحقة", "متابعتان مستحقتان", "متابعات مستحقة", "متابعة مستحقة"])} مع العملاء`, href: "/clients/communications" },
    can(user, "clients") && clientAlerts.counts.expired > 0 && { tone: "rose", title: `${countText(clientAlerts.counts.expired, ["عنصر واحد منتهي الصلاحية", "عنصران منتهيا الصلاحية", "عناصر منتهية الصلاحية", "عنصراً منتهي الصلاحية"])} في تنبيهات العملاء`, href: "/clients/alerts" },
    canAccess(user, findSection("employees")!) && hrAlerts.length > 0 && { tone: "amber", title: `${countText(hrAlerts.length, ["تنبيه واحد", "تنبيهان", "تنبيهات", "تنبيهاً"])} على وثائق الموظفين وعقودهم`, href: "/employees/profiles" },
  ].filter(Boolean) as { tone: "rose" | "amber" | "sky"; title: string; href: string }[];
  const DOT = { rose: "bg-rose-400", amber: "bg-gold-400", sky: "bg-sky-400" };

  // بيانات الرسم الشهري
  const created = new Map<string, number>();
  for (const r of createdRows) created.set(monthOf(r.createdAt), (created.get(monthOf(r.createdAt)) ?? 0) + 1);
  const doneSeen = new Set<string>();
  const done = new Map<string, number>();
  for (const e of doneEvents) {
    const k = monthOf(e.createdAt), id = `${k}:${e.transactionId}`;
    if (doneSeen.has(id)) continue;
    doneSeen.add(id);
    done.set(k, (done.get(k) ?? 0) + 1);
  }
  const chart: MonthPoint[] = months.map((k) => {
    const mi = Number(k.slice(5, 7)) - 1;
    return { key: k, short: GREGORIAN_MONTHS[mi], label: `${GREGORIAN_MONTHS[mi]} ${k.slice(0, 4)}`, created: created.get(k) ?? 0, done: done.get(k) ?? 0 };
  });

  // نسبة الإنجاز: المكتملة من مجموع (المكتملة + الجارية)، والملغاة لا تُحتسب
  const rateBase = doneTx + openTx;
  const rate = rateBase ? Math.round((doneTx / rateBase) * 100) : null;

  const quick = [
    can(user, "requests", "EDIT") && { label: "معاملة جديدة", href: "/requests/all/new", primary: true },
    can(user, "clients", "EDIT") && { label: "العملاء", href: "/clients/directory" },
    user.employeeId && { label: "طلب إجازة", href: "/me" },
  ].filter(Boolean) as { label: string; href: string; primary?: boolean }[];

  const sectionTiles = [
    ...SECTIONS.filter((s) => canAccess(user, s)).map((s) => ({ title: s.title, href: `/${s.slug}/${s.subs[0].slug}`, icon: SECTION_ICONS[s.icon] })),
    ...(user.isAdmin ? [{ title: "الإعدادات", href: "/settings/users", icon: Settings }] : []),
  ];

  const hour = Number(riyadhHM(new Date()).slice(0, 2));
  const greeting = hour < 12 ? "صباح الخير" : "مساء الخير";
  const stageDot = { OPEN: "bg-sky-400", DONE: "bg-emerald-400", CANCELLED: "bg-navy-300" } as const;
  const total = openTx + doneTx + cancelledTx;
  const share = (n: number) => (total ? `${(n / total) * 100}%` : "0%");

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 font-sans">
      {/* الترويسة: تحية + التاريخ الهجري والميلادي + الإجراءات السريعة */}
      <header className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-navy-950/40">
        <Image src={BRAND.skyline} alt="" fill priority sizes="(min-width: 1024px) 75vw, 100vw"
          className="object-cover object-[center_70%] opacity-25 [mask-image:linear-gradient(to_left,transparent,black_70%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 px-6 py-7 sm:px-8">
          <div className="space-y-1.5">
            <p className="text-[13px] text-navy-200 tabular-nums">{formatDateLong(new Date())} · {formatHijri(new Date())}</p>
            <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[32px]">{greeting}، {user.name}</h1>
            <p className="text-[15px] text-navy-100">
              {actions.length > 0
                ? <>لديك <span className="font-semibold text-gold-300">{countText(actions.length, ["أمر واحد", "أمران", "أمور", "أمراً"])}</span> بانتظار إجرائك اليوم.</>
                : "لا توجد أمور عاجلة اليوم."}
            </p>
          </div>
          {quick.length > 0 && (
            <nav aria-label="إجراءات سريعة" className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <Link key={q.href} href={q.href}
                  className={q.primary
                    ? "btn-primary !rounded-lg !px-4 !py-2 text-sm"
                    : "inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-gold-400"}>
                  {q.primary && <Plus size={16} aria-hidden="true" />} {q.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      {user.employeeId && me && me.status !== "TERMINATED" && <AttendanceWidget employeeId={user.employeeId} />}

      {/* المؤشرات: لوحة واحدة مقسّمة بدل مربعات منفصلة */}
      {stats.length > 0 && (
        <section aria-label="المؤشرات" className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          {/* صفوف مرنة: آخر صف يتمدد ليملأ العرض مهما كان عدد المؤشرات حسب الصلاحيات */}
          <div className="flex flex-wrap gap-px bg-white/[0.06]">
            {stats.map(({ label, value, icon: Icon, href, alert }) => (
              <Link key={label} href={href}
                className="group flex min-w-[9.5rem] flex-1 basis-[calc(20%-1px)] flex-col gap-3 bg-navy-950/80 px-5 py-4 transition-colors hover:bg-navy-900 focus-visible:relative focus-visible:ring-2 focus-visible:ring-gold-400">
                <span className="flex items-center justify-between gap-2 text-[13px] text-navy-200">
                  <span className="truncate">{label}</span>
                  <Icon size={15} className="shrink-0 text-navy-300 transition-colors group-hover:text-navy-100" aria-hidden="true" />
                </span>
                <span className={`text-[26px] font-semibold leading-none tabular-nums ${alert ? "text-rose-300" : "text-white"}`}>{value}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12 [&>*]:min-w-0">
        {/* يحتاج إجراءك — أهم لوحة في الصفحة */}
        <Panel title="يحتاج إجراءك" count={actions.length} className="xl:col-span-5">
          {actions.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-navy-200">لا توجد أمور عاجلة. يظهر هنا ما ينتظر موافقتك أو استلامك أو تسليمك.</p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {actions.map((a) => (
                <li key={a.title}>
                  <Link href={a.href} className="group flex items-center gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.05] focus-visible:outline-none">
                    <span className={`size-2 shrink-0 rounded-full ${DOT[a.tone]}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-white">{a.title}</span>
                    <ArrowLeft size={15} className="shrink-0 text-navy-300 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {seeRequests && (
          <Panel title="المعاملات الحديثة" href="/requests/all" className="xl:col-span-7">
            {recent.length === 0 ? <p className="px-5 py-8 text-center text-sm text-navy-200">لا توجد معاملات بعد. ابدأ بإضافة أول معاملة.</p> : (
              <ul className="divide-y divide-white/[0.06]">
                {recent.map((t) => {
                  const late = t.stage.kind === "OPEN" && t.dueDate && t.dueDate < new Date();
                  return (
                    <li key={t.id}>
                      <Link href={`/requests/all/${t.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-3 transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.05] focus-visible:outline-none">
                        <span dir="ltr" className="w-16 text-[12px] text-navy-300 tabular-nums">{txNumber(t.number)}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white">{t.title}</span>
                          <span className="block truncate text-[12.5px] text-navy-200">{t.company.name}</span>
                        </span>
                        <span className="flex items-center gap-2 whitespace-nowrap text-[12.5px] text-navy-100">
                          <span className={`size-1.5 rounded-full ${late ? "bg-rose-400" : stageDot[t.stage.kind]}`} aria-hidden="true" />
                          {late ? "متأخرة" : t.stage.name}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}
      </div>

      {seeRequests && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12 [&>*]:min-w-0">
          <Panel title="حركة المعاملات" meta="آخر 12 شهراً" className="xl:col-span-8">
            <div className="px-5 pb-4 pt-3"><MonthlyChart data={chart} tone="dark" W={640} H={210} /></div>
          </Panel>

          {/* نظرة عامة: شريط واحد مقسّم بدل الدائرة */}
          <Panel title="نظرة عامة" className="xl:col-span-4">
            <div className="space-y-5 px-5 py-5">
              <div>
                <p className="text-[13px] text-navy-200">نسبة الإنجاز</p>
                <p className="mt-1 text-[34px] font-semibold leading-none text-white tabular-nums">{rate === null ? "—" : `${rate}%`}</p>
                <p className="mt-1.5 text-[12.5px] text-navy-300">المكتملة من مجموع المكتملة والجارية، دون الملغاة.</p>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]" role="img"
                aria-label={`جارية ${openTx}، مكتملة ${doneTx}، ملغاة ${cancelledTx}`}>
                <span className="bg-emerald-400" style={{ width: share(doneTx) }} />
                <span className="bg-sky-400" style={{ width: share(openTx) }} />
                <span className="bg-navy-400" style={{ width: share(cancelledTx) }} />
              </div>
              <dl className="space-y-2.5 text-sm">
                {[
                  { label: "مكتملة", value: doneTx, dot: "bg-emerald-400" },
                  { label: "جارية", value: openTx, dot: "bg-sky-400" },
                  { label: "متأخرة من الجارية", value: overdueTx, dot: "bg-rose-400" },
                  { label: "ملغاة", value: cancelledTx, dot: "bg-navy-400" },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-2">
                    <dt className="flex items-center gap-2 text-navy-100"><span className={`size-2 rounded-full ${r.dot}`} aria-hidden="true" />{r.label}</dt>
                    <dd className="font-medium text-white tabular-nums">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Panel>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12 [&>*]:min-w-0">
        {seeRequests && (
          <Panel title="معاملاتي القادمة" href="/requests/all?assignee=me" className="xl:col-span-7">
            {myUpcoming.length === 0 ? <p className="px-5 py-8 text-center text-sm text-navy-200">لا توجد معاملات مسندة إليك.</p> : (
              <ul className="divide-y divide-white/[0.06]">
                {myUpcoming.map((t) => {
                  const d = t.dueDate ? daysUntil(t.dueDate) : null;
                  return (
                    <li key={t.id}>
                      <Link href={`/requests/all/${t.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.05] focus-visible:outline-none">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white">{t.title}</span>
                          <span className="block truncate text-[12.5px] text-navy-200">{t.company.name}</span>
                        </span>
                        <span className={`shrink-0 text-[12.5px] tabular-nums ${d !== null && d < 0 ? "text-rose-300" : d !== null && d <= 3 ? "text-gold-300" : "text-navy-200"}`}>
                          {t.dueDate ? (d !== null && d < 0 ? `متأخرة · ${formatDate(t.dueDate)}` : formatDate(t.dueDate)) : "بلا موعد"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        <Panel title="أقسام المنصة" className={seeRequests ? "xl:col-span-5" : "xl:col-span-12"}>
          <ul className="grid grid-cols-1 gap-px bg-white/[0.06] sm:grid-cols-2">
            {sectionTiles.map(({ title, href, icon: Icon }) => (
              <li key={href} className="bg-navy-950/80">
                <Link href={href} className="group flex items-center gap-3 px-5 py-3.5 text-sm text-white transition-colors hover:bg-navy-900 focus-visible:bg-navy-900 focus-visible:outline-none">
                  <Icon size={17} className="text-navy-200 transition-colors group-hover:text-gold-300" aria-hidden="true" />
                  <span className="flex-1">{title}</span>
                  <ArrowLeft size={14} className="text-navy-400 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </Link>
              </li>
            ))}
            {sectionTiles.length % 2 === 1 && <li aria-hidden="true" className="hidden bg-navy-950/80 sm:block" />}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

// لوحة موحّدة: حد رفيع، ترويسة بعنوان وعدد أو رابط، ومحتوى بلا حشو إضافي
function Panel({ title, href, count, meta, className = "", children }: {
  title: string; href?: string; count?: number; meta?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
        <h2 className="flex items-center gap-2 font-sans text-[15px] font-semibold text-white">
          {title}
          {count !== undefined && count > 0 && <span className="rounded-md bg-gold-500/15 px-1.5 text-[12px] font-semibold text-gold-300 tabular-nums">{count}</span>}
        </h2>
        {href && <Link href={href} className="flex items-center gap-1 text-[13px] text-navy-200 transition-colors hover:text-white">عرض الكل <ArrowLeft size={13} aria-hidden="true" /></Link>}
        {meta && <span className="text-[12.5px] text-navy-300">{meta}</span>}
      </div>
      {children}
    </section>
  );
}
