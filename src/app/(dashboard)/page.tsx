import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, BellRing, Building, CalendarClock, ClipboardList, FolderOpen, Handshake, IdCard, Megaphone, Plane, Plus, Settings, UserCheck, Users, Wallet,
} from "lucide-react";
import { getClientAlerts } from "@/lib/client-alerts";
import { getHrAlerts } from "@/lib/hr-alerts";
import AttendanceWidget from "@/components/AttendanceWidget";
import { ButtonLink, Dot, Icon, List, ListRow, Panel, PanelEmpty, Stat, StatGroup, TONE_BG, TONE_TEXT, type Tone } from "@/components/ds";
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
  const ACTION_TONE: Record<"rose" | "amber" | "sky", Tone> = { rose: "danger", amber: "accent", sky: "info" };
  const STAGE_TONE: Record<"OPEN" | "DONE" | "CANCELLED", Tone> = { OPEN: "info", DONE: "success", CANCELLED: "neutral" };
  const total = openTx + doneTx + cancelledTx;
  const share = (n: number) => (total ? `${(n / total) * 100}%` : "0%");

  return (
    <div className="mx-auto max-w-[1240px] space-y-6">
      {/* الترويسة */}
      <header className="relative overflow-hidden rounded-ds-panel border border-ds-line bg-ds-surface shadow-ds-panel">
        <Image src={BRAND.skyline} alt="" fill priority sizes="(min-width: 1024px) 75vw, 100vw"
          className="object-cover object-[center_70%] opacity-20 [mask-image:linear-gradient(to_left,transparent_15%,black_75%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 px-6 py-7 sm:px-8">
          <div className="space-y-2">
            <p className="text-[13px] text-ds-muted tabular-nums">{formatDateLong(new Date())}<span className="mx-2 text-ds-faint" aria-hidden="true">|</span>{formatHijri(new Date())}</p>
            <h1 className="font-heading text-[28px] font-medium leading-tight text-ds-text sm:text-[32px]">{greeting}، {user.name}</h1>
            <p className="text-[15px] text-ds-muted">
              {actions.length > 0
                ? <>لديك <span className="font-medium text-ds-accent">{countText(actions.length, ["أمر واحد", "أمران", "أمور", "أمراً"])}</span> بانتظار إجرائك اليوم.</>
                : "لا توجد أمور عاجلة اليوم."}
            </p>
          </div>
          {quick.length > 0 && (
            <nav aria-label="إجراءات سريعة" className="flex flex-wrap gap-2">
              {quick.map((q) => <ButtonLink key={q.href} href={q.href} variant={q.primary ? "primary" : "secondary"} icon={q.primary ? Plus : undefined}>{q.label}</ButtonLink>)}
            </nav>
          )}
        </div>
      </header>

      {user.employeeId && me && me.status !== "TERMINATED" && <AttendanceWidget employeeId={user.employeeId} />}

      {stats.length > 0 && (
        <StatGroup label="المؤشرات">
          {stats.map(({ label, value, icon, href, alert }) => <Stat key={label} label={label} value={value} href={href} icon={icon} alert={alert} />)}
        </StatGroup>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12 [&>*]:min-w-0">
        <Panel title="يحتاج إجراءك" count={actions.length} className="xl:col-span-5">
          {actions.length === 0 ? <PanelEmpty>لا توجد أمور عاجلة. يظهر هنا ما ينتظر موافقتك أو استلامك أو تسليمك.</PanelEmpty> : (
            <List>
              {actions.map((a) => (
                <ListRow key={a.title} href={a.href} leading={<Dot tone={ACTION_TONE[a.tone]} />} title={a.title}
                  trailing={<Icon icon={ArrowLeft} className="text-ds-faint transition-transform group-hover:-translate-x-0.5" />} />
              ))}
            </List>
          )}
        </Panel>

        {seeRequests && (
          <Panel title="المعاملات الحديثة" href="/requests/all" className="xl:col-span-7">
            {recent.length === 0 ? <PanelEmpty>لا توجد معاملات بعد. ابدأ بإضافة أول معاملة.</PanelEmpty> : (
              <List>
                {recent.map((t) => {
                  const late = t.stage.kind === "OPEN" && t.dueDate && t.dueDate < new Date();
                  return (
                    <ListRow key={t.id} href={`/requests/all/${t.id}`}
                      leading={<span dir="ltr" className="w-16 text-[12px] text-ds-faint tabular-nums">{txNumber(t.number)}</span>}
                      title={t.title} subtitle={t.company.name}
                      trailing={<span className="flex items-center gap-2"><Dot tone={late ? "danger" : STAGE_TONE[t.stage.kind]} size="sm" />{late ? "متأخرة" : t.stage.name}</span>} />
                  );
                })}
              </List>
            )}
          </Panel>
        )}
      </div>

      {seeRequests && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12 [&>*]:min-w-0">
          <Panel title="حركة المعاملات" meta="آخر 12 شهراً" className="xl:col-span-8">
            {/* على الجوال يتمرر الرسم داخل اللوحة بدل تصغير نصوصه، ويبدأ من أحدث شهر (الحاوية ltr والمحتوى rtl) */}
            <div dir="ltr" className="overflow-x-auto px-5 pb-4 pt-3"><div dir="rtl" className="min-w-[540px]"><MonthlyChart data={chart} tone="dark" W={640} H={210} /></div></div>
          </Panel>

          <Panel title="نظرة عامة" className="xl:col-span-4">
            <div className="space-y-5 p-5">
              <div>
                <p className="text-[13px] text-ds-muted">نسبة الإنجاز</p>
                <p className="mt-1 font-heading text-[34px] font-medium leading-none text-ds-text tabular-nums">{rate === null ? "—" : `${rate}%`}</p>
                <p className="mt-1.5 text-[12.5px] text-ds-faint">المكتملة من مجموع المكتملة والجارية، دون الملغاة.</p>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-ds-line" role="img" aria-label={`مكتملة ${doneTx}، جارية ${openTx}، ملغاة ${cancelledTx}`}>
                <span className={TONE_BG.success} style={{ width: share(doneTx) }} />
                <span className={TONE_BG.info} style={{ width: share(openTx) }} />
                <span className={TONE_BG.neutral} style={{ width: share(cancelledTx) }} />
              </div>
              <dl className="space-y-2.5 text-sm">
                {([
                  ["مكتملة", doneTx, "success"], ["جارية", openTx, "info"], ["متأخرة من الجارية", overdueTx, "danger"], ["ملغاة", cancelledTx, "neutral"],
                ] as [string, number, Tone][]).map(([label, value, tone]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <dt className="flex items-center gap-2 text-ds-muted"><Dot tone={tone} />{label}</dt>
                    <dd className="font-medium text-ds-text tabular-nums">{value}</dd>
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
            {myUpcoming.length === 0 ? <PanelEmpty>لا توجد معاملات مسندة إليك.</PanelEmpty> : (
              <List>
                {myUpcoming.map((t) => {
                  const d = t.dueDate ? daysUntil(t.dueDate) : null;
                  const tone = d !== null && d < 0 ? TONE_TEXT.danger : d !== null && d <= 3 ? TONE_TEXT.accent : "";
                  return (
                    <ListRow key={t.id} href={`/requests/all/${t.id}`} title={t.title} subtitle={t.company.name}
                      trailing={<span className={`tabular-nums ${tone}`}>{t.dueDate ? (d !== null && d < 0 ? `متأخرة · ${formatDate(t.dueDate)}` : formatDate(t.dueDate)) : "بلا موعد"}</span>} />
                  );
                })}
              </List>
            )}
          </Panel>
        )}

        <Panel title="أقسام المنصة" className={seeRequests ? "xl:col-span-5" : "xl:col-span-12"}>
          <ul className="grid grid-cols-1 gap-px bg-ds-line sm:grid-cols-2">
            {sectionTiles.map(({ title, href, icon }) => (
              <li key={href} className="bg-ds-surface">
                <Link href={href} className="group flex min-h-12 items-center gap-3 px-5 text-sm text-ds-text transition-colors hover:bg-ds-hover/60 focus-visible:bg-ds-hover focus-visible:outline-none">
                  <Icon icon={icon} className="text-ds-faint transition-colors group-hover:text-ds-accent" />
                  <span className="flex-1">{title}</span>
                  <Icon icon={ArrowLeft} className="text-ds-faint opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
            {sectionTiles.length % 2 === 1 && <li aria-hidden="true" className="hidden bg-ds-surface sm:block" />}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
