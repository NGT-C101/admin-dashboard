import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, BellRing, Building, CalendarClock, CheckCircle2, ClipboardList, Clock, FolderOpen, Handshake,
  IdCard, Megaphone, Plane, Plus, Settings, UserCheck, Users, Wallet, XCircle,
} from "lucide-react";
import { getClientAlerts } from "@/lib/client-alerts";
import { getHrAlerts } from "@/lib/hr-alerts";
import AttendanceWidget from "@/components/AttendanceWidget";
import MonthlyChart, { type MonthPoint } from "@/components/MonthlyChart";
import Image from "next/image";
import StageBadge from "@/components/ui/StageBadge";
import { GREGORIAN_MONTHS, currentMonthKey, dateKey, monthBounds, riyadhToday } from "@/lib/time";
import { daysUntil, endOfToday } from "@/lib/clients";
import { can, canAccess, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { formatDate, formatDateLong, txNumber } from "@/lib/format";
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
  const R = 54, C = 2 * Math.PI * R;

  const quick = [
    can(user, "requests", "EDIT") && { label: "معاملة جديدة", href: "/requests/all/new", primary: true },
    can(user, "clients", "EDIT") && { label: "العملاء", href: "/clients/directory" },
    user.employeeId && { label: "طلب إجازة", href: "/me" },
  ].filter(Boolean) as { label: string; href: string; primary?: boolean }[];

  const sectionTiles = [
    ...SECTIONS.filter((s) => canAccess(user, s)).map((s) => ({ title: s.title, href: `/${s.slug}/${s.subs[0].slug}`, icon: SECTION_ICONS[s.icon] })),
    ...(user.isAdmin ? [{ title: "الإعدادات", href: "/settings/users", icon: Settings }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* البانر الرئيسي */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/40">
        <Image src={BRAND.skyline} alt="" fill priority sizes="(min-width: 1024px) 75vw, 100vw" className="object-cover object-[center_70%]" />
        <div className="absolute inset-0 bg-gradient-to-l from-navy-950/95 via-navy-950/60 to-navy-950/10" />
        <div className="relative flex min-h-60 flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gold-300">{formatDateLong(new Date())}</p>
            <h1 className="text-4xl font-extrabold leading-snug sm:text-5xl"><span className="text-gold-gradient">{BRAND.slogan}</span></h1>
            <p className="text-navy-100">{BRAND.company} {BRAND.tagline}</p>
            {quick.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-3">
                {quick.map((q) => (
                  <Link key={q.href} href={q.href} className={q.primary ? "btn-primary" : "inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"}>
                    {q.primary && <Plus size={16} />} {q.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-navy-900/60 p-4 backdrop-blur-md">
            <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 text-navy-950" aria-hidden="true"><Handshake size={24} /></span>
            <div>
              <p className="text-sm text-navy-100">مرحباً بعودتك،</p>
              <p className="text-lg font-bold text-white">{user.name}</p>
              <p className="text-xs text-gold-300">
                {actions.length > 0 ? `${countText(actions.length, ["أمر واحد يحتاج", "أمران يحتاجان", "أمور تحتاج", "أمراً يحتاج"])} إجراءً اليوم` : "لا توجد أمور عاجلة اليوم"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {user.employeeId && me && me.status !== "TERMINATED" && <AttendanceWidget employeeId={user.employeeId} />}

      {stats.length > 0 && <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map(({ label, value, icon: Icon, href, alert, tile }) => (
          <Link key={label} href={href} className="card-dark flex items-center gap-3 p-4 transition hover:border-gold-500/50 sm:p-5">
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${tile}`} aria-hidden="true">
              <Icon size={22} />
            </span>
            <span className="min-w-0">
              <span className={`stat-value block ${alert ? "text-rose-300" : "text-white"}`}>{value}</span>
              <span className="block truncate text-xs text-navy-100 sm:text-sm">{label}</span>
            </span>
          </Link>
        ))}
      </div>}

      {seeRequests && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
          <section className="card p-5 xl:col-span-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">المعاملات الحديثة</h2>
              <Link href="/requests/all" className="link flex items-center gap-1 text-sm">عرض الكل <ArrowLeft size={14} /></Link>
            </div>
            {recent.length === 0 ? <p className="text-sm text-neutral-600">لا توجد معاملات بعد.</p> : (
              <ul className="divide-y divide-neutral-100">
                {recent.map((t) => {
                  const late = t.stage.kind === "OPEN" && t.dueDate && t.dueDate < new Date();
                  const Icon = t.stage.kind === "DONE" ? CheckCircle2 : t.stage.kind === "CANCELLED" ? XCircle : late ? AlertTriangle : Clock;
                  const tone = t.stage.kind === "DONE" ? "bg-emerald-50 text-emerald-700" : t.stage.kind === "CANCELLED" ? "bg-rose-50 text-rose-700" : late ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700";
                  return (
                    <li key={t.id}>
                      <Link href={`/requests/all/${t.id}`} className="flex items-center gap-3 py-3 hover:bg-neutral-50">
                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`} aria-hidden="true"><Icon size={18} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{t.title}</span>
                          <span className="block truncate text-xs text-neutral-600">{t.company.name} · <span dir="ltr">{txNumber(t.number)}</span></span>
                        </span>
                        <StageBadge name={t.stage.name} kind={t.stage.kind} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card p-5 xl:col-span-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">حركة المعاملات</h2>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">آخر 12 شهراً</span>
            </div>
            <MonthlyChart data={chart} />
          </section>

          <section className="card-dark p-5 xl:col-span-3">
            <h2 className="text-lg font-bold text-white">نظرة عامة على المعاملات</h2>
            <div className="my-5 flex justify-center">
              <div className="relative size-40">
                <svg viewBox="0 0 140 140" className="size-full -rotate-90" role="img" aria-label={rate === null ? "لا توجد معاملات" : `نسبة الإنجاز ${rate}%`}>
                  <defs>
                    <linearGradient id="rateGold" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#f0d08a" />
                      <stop offset="1" stopColor="#b8862f" />
                    </linearGradient>
                  </defs>
                  <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
                  {rate !== null && rate > 0 && (
                    <circle cx="70" cy="70" r={R} fill="none" stroke="url(#rateGold)" strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={`${(rate / 100) * C} ${C}`} />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-extrabold text-white">{rate === null ? "—" : `${rate}%`}</span>
                  <span className="text-xs text-navy-100">نسبة الإنجاز</span>
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: "جارية", value: openTx, dot: "bg-sky-400" },
                { label: "مكتملة", value: doneTx, dot: "bg-gold-400" },
                { label: "متأخرة", value: overdueTx, dot: "bg-rose-400" },
                { label: "ملغاة", value: cancelledTx, dot: "bg-navy-300" },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2">
                  <dt className="flex items-center gap-2 text-navy-100"><span className={`size-2 rounded-full ${r.dot}`} aria-hidden="true" />{r.label}</dt>
                  <dd className="font-bold tabular-nums text-white">{r.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        {seeRequests && (
          <section className="card p-5 xl:col-span-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">معاملاتي القادمة</h2>
              <Link href="/requests/all?assignee=me" className="link flex items-center gap-1 text-sm">عرض الكل <ArrowLeft size={14} /></Link>
            </div>
            {myUpcoming.length === 0 ? <p className="text-sm text-neutral-600">لا توجد معاملات مسندة إليك.</p> : (
              <ul className="divide-y divide-neutral-100">
                {myUpcoming.map((t) => {
                  const d = t.dueDate ? daysUntil(t.dueDate) : null;
                  return (
                    <li key={t.id}>
                      <Link href={`/requests/all/${t.id}`} className="flex items-center gap-3 py-3 hover:bg-neutral-50">
                        <CalendarClock size={18} className="shrink-0 text-navy-600" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{t.title}</span>
                          <span className="block truncate text-xs text-neutral-600">{t.company.name}</span>
                        </span>
                        <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${d !== null && d < 0 ? "bg-rose-50 text-rose-700" : "bg-neutral-100 text-neutral-700"}`}>
                          {formatDate(t.dueDate)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <section className={`card-dark p-5 ${seeRequests ? "xl:col-span-4" : "xl:col-span-6"}`}>
          <h2 className="mb-3 text-lg font-bold text-white">تحتاج إجراء</h2>
          {actions.length === 0 ? <p className="text-sm text-navy-100">لا توجد أمور عاجلة.</p> : (
            <ul className="space-y-2">
              {actions.map((a) => (
                <li key={a.title}>
                  <Link href={a.href} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-semibold text-white hover:bg-white/10">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[a.tone]}`} aria-hidden="true" />
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`card-dark p-5 ${seeRequests ? "xl:col-span-4" : "xl:col-span-6"}`}>
          <h2 className="mb-3 text-lg font-bold text-white">أقسام المنصة</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {sectionTiles.map(({ title, href, icon: Icon }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-4 text-center text-sm font-semibold text-white hover:border-gold-500/50 hover:bg-white/10">
                <Icon size={24} className="text-gold-300" aria-hidden="true" />
                {title}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
