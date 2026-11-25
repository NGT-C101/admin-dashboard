import Link from "next/link";
import { AlertTriangle, BellRing, Building, CalendarClock, ClipboardList, Handshake, UserCheck } from "lucide-react";
import { getClientAlerts } from "@/lib/client-alerts";
import { endOfToday } from "@/lib/clients";
import { canAccess, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SECTIONS, findSection } from "@/lib/nav";

export default async function HomePage() {
  const user = await requireUser();
  const open = { stage: { kind: "OPEN" as const } };
  const [clients, companies, openTx, overdueTx, myTx, clientAlerts, myFollowUps] = await Promise.all([
    db.client.count(),
    db.company.count(),
    db.transaction.count({ where: open }),
    db.transaction.count({ where: { ...open, dueDate: { lt: new Date() } } }),
    db.transaction.count({ where: { ...open, assigneeId: user.id } }),
    getClientAlerts(),
    db.interaction.count({ where: { assigneeId: user.id, followUpDone: false, followUpAt: { not: null, lte: endOfToday() } } }),
  ]);

  const allStats = [
    { label: "العملاء", value: clients, icon: Handshake, href: "/clients/directory" },
    { label: "الشركات", value: companies, icon: Building, href: "/clients/companies" },
    { label: "معاملات جارية", value: openTx, icon: ClipboardList, href: "/requests/all" },
    { label: "معاملات متأخرة", value: overdueTx, icon: AlertTriangle, href: "/requests/all?status=overdue", alert: overdueTx > 0 },
    { label: "معاملاتي الجارية", value: myTx, icon: UserCheck, href: "/requests/all?assignee=me" },
    { label: "تنبيهات العملاء", value: clientAlerts.counts.total, icon: BellRing, href: "/clients/alerts", alert: clientAlerts.counts.expired > 0 },
    { label: "متابعاتي المستحقة", value: myFollowUps, icon: CalendarClock, href: "/clients/communications", alert: myFollowUps > 0 },
  ];
  // كل رقم يظهر بس للي عنده صلاحية على القسم بتاعه
  const stats = allStats.filter((s) => canAccess(user, findSection(s.href.split("/")[1])!));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">أهلاً، {user.name} 👋</h1>
        <p className="text-neutral-500 mt-1">نظرة سريعة على أحوال الشركة</p>
      </div>

      {stats.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href, alert }) => (
          <Link key={label} href={href} className="card p-5 flex items-center gap-4 hover:ring-2 hover:ring-brand-600/20">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${alert ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-700"}`}>
              <Icon size={22} />
            </div>
            <div>
              <div className={`text-2xl font-bold ${alert ? "text-rose-600" : ""}`}>{value}</div>
              <div className="text-sm text-neutral-500">{label}</div>
            </div>
          </Link>
        ))}
      </div>}

      <div>
        <h2 className="text-lg font-semibold mb-3">الأقسام</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.filter((s) => canAccess(user, s)).map((s) => (
            <div key={s.slug} className="card p-5">
              <h3 className="font-semibold mb-3">{s.title}</h3>
              <div className="flex flex-wrap gap-2">
                {s.subs.map((sub) => (
                  <Link
                    key={sub.slug}
                    href={`/${s.slug}/${sub.slug}`}
                    className="text-xs rounded-full bg-neutral-100 px-3 py-1 text-neutral-700 hover:bg-brand-50 hover:text-brand-800"
                  >
                    {sub.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
