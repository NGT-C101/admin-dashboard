import Link from "next/link";
import { AlertTriangle, CalendarClock, FileWarning, FileSignature, Building2 } from "lucide-react";
import type { ClientAlerts } from "@/lib/client-alerts";
import { daysText, daysUntil } from "@/lib/clients";
import { DOC_TYPE_LABELS } from "@/lib/documents";
import { formatDate, formatDateTime } from "@/lib/format";
import { contractNumber } from "@/components/ContractsTable";

function When({ date }: { date: Date }) {
  const d = daysUntil(date);
  const cls = d < 0 ? "text-rose-600 font-semibold" : d <= 7 ? "text-amber-600 font-semibold" : "text-neutral-600";
  const label = d < 0 ? `متأخر ${daysText(d)}` : d === 0 ? "اليوم" : `متبقٍ ${daysText(d)}`;
  return <span className={`text-xs whitespace-nowrap ${cls}`}>{label}</span>;
}

function Group({ title, icon: Icon, count, children }: { title: string; icon: typeof AlertTriangle; count: number; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="flex items-center gap-2 p-4 font-semibold border-b border-neutral-100">
        <Icon size={18} className="text-brand-700" /> {title}
        <span className={`mr-auto rounded-full px-2 text-xs ${count ? "bg-brand-50 text-brand-800" : "bg-neutral-100 text-neutral-500"}`}>{count}</span>
      </h2>
      {count === 0 ? <p className="p-4 text-sm text-neutral-500">لا توجد تنبيهات ✅</p> : <ul className="divide-y divide-neutral-100">{children}</ul>}
    </section>
  );
}

function Row({ href, title, sub, date, extra }: { href: string; title: React.ReactNode; sub?: React.ReactNode; date: Date; extra?: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 p-3 hover:bg-neutral-50">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{title}</div>
          {sub && <div className="text-xs text-neutral-500 truncate">{sub}</div>}
        </div>
        <div className="text-left">
          <div className="text-xs text-neutral-500 whitespace-nowrap">{extra ?? formatDate(date)}</div>
          <When date={date} />
        </div>
      </Link>
    </li>
  );
}

export default function ClientAlertsView({ alerts, hideClient }: { alerts: ClientAlerts; hideClient?: boolean }) {
  const c = (name: string) => (hideClient ? undefined : name);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Group title="المتابعات (المتأخرة والمستحقة خلال 7 أيام)" icon={CalendarClock} count={alerts.followUps.length}>
        {alerts.followUps.map((f) => (
          <Row key={f.id} href={`/clients/directory/${f.client.id}?tab=communications`} date={f.followUpAt!} extra={formatDateTime(f.followUpAt!)}
            title={f.followUpNote || f.summary} sub={[c(f.client.name), f.assignee?.name].filter(Boolean).join(" · ")} />
        ))}
      </Group>
      <Group title="العقود المنتهية أو التي توشك على الانتهاء" icon={FileSignature} count={alerts.contracts.length}>
        {alerts.contracts.map((k) => (
          <Row key={k.id} href={`/clients/contracts/${k.id}`} date={k.endDate!}
            title={`${contractNumber(k.number)} · ${k.title}`} sub={[c(k.client.name), k.company?.name, k.autoRenew ? "تجديد تلقائي" : null].filter(Boolean).join(" · ")} />
        ))}
      </Group>
      <Group title="مستندات منتهية أو تنتهي خلال 60 يوماً" icon={FileWarning} count={alerts.documents.length}>
        {alerts.documents.map((d) => {
          const owner = d.company ? { href: `/clients/companies/${d.company.id}?tab=documents`, name: d.company.name, client: d.company.client.name }
            : { href: `/clients/directory/${d.client!.id}?tab=documents`, name: d.client!.name, client: d.client!.name };
          return <Row key={d.id} href={owner.href} date={d.expiresAt!} title={`${DOC_TYPE_LABELS[d.type]}${d.title ? ` · ${d.title}` : ""}`}
            sub={hideClient ? owner.name : [owner.client, d.company ? owner.name : null].filter(Boolean).join(" · ")} />;
        })}
      </Group>
      <Group title="سجلات تجارية تنتهي خلال 60 يوماً" icon={Building2} count={alerts.crs.length}>
        {alerts.crs.map((co) => (
          <Row key={co.id} href={`/clients/companies/${co.id}`} date={co.crExpiry!} title={co.name} sub={[c(co.client.name), co.crNumber].filter(Boolean).join(" · ")} />
        ))}
      </Group>
    </div>
  );
}
