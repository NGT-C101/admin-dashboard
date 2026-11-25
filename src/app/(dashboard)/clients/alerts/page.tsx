import Link from "next/link";
import ClientAlertsView from "@/components/ClientAlertsView";
import PageHeader from "@/components/ui/PageHeader";
import { requireSection } from "@/lib/auth";
import { getClientAlerts } from "@/lib/client-alerts";

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const user = await requireSection("clients");
  const { mine } = await searchParams;
  const alerts = await getClientAlerts(mine ? { managerId: user.id } : {});
  return (
    <div className="space-y-6">
      <PageHeader title="التنبيهات والمواعيد" crumbs={[{ label: "العملاء", href: "/clients/directory" }, { label: "التنبيهات" }]}
        actions={
          <Link href={mine ? "/clients/alerts" : "/clients/alerts?mine=1"} className="btn-secondary">
            {mine ? "كل العملاء" : "عملائي فقط"}
          </Link>
        } />
      <p className="text-sm text-neutral-600">
        جميع المهام والمواعيد المتعلقة بعملائكم في مكان واحد. يُنصح بمراجعة هذه الصفحة يومياً.
        {mine && <b> (المعروض حالياً: العملاء المسندون إليك)</b>}
      </p>
      <ClientAlertsView alerts={alerts} />
    </div>
  );
}
