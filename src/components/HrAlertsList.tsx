import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { daysText, daysUntil } from "@/lib/clients";
import { formatDate } from "@/lib/format";
import type { HrAlert } from "@/lib/hr-alerts";

export default function HrAlertsList({ alerts, hideName }: { alerts: HrAlert[]; hideName?: boolean }) {
  if (alerts.length === 0) return <p className="p-4 text-sm text-neutral-500">لا توجد تنبيهات ✅</p>;
  return (
    <ul className="divide-y divide-neutral-100">
      {alerts.map((a, i) => {
        const d = daysUntil(a.date);
        return (
          <li key={i}>
            <Link href={`/employees/profiles/${a.employeeId}`} className="flex items-center gap-3 p-3 hover:bg-neutral-50">
              <CalendarClock size={16} className={d < 0 ? "text-rose-600" : "text-amber-600"} />
              <div className="flex-1 min-w-0 text-sm">
                <span className="font-medium">{a.label}</span>{!hideName && <span className="text-neutral-500"> — {a.name}</span>}
              </div>
              <div className="text-left text-xs whitespace-nowrap">
                <div className="text-neutral-500">{formatDate(a.date)}</div>
                <div className={d < 0 ? "text-rose-600 font-semibold" : d <= 14 ? "text-amber-600 font-semibold" : "text-neutral-600"}>
                  {d < 0 ? `متأخر ${daysText(d)}` : d === 0 ? "اليوم" : `متبقٍ ${daysText(d)}`}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
