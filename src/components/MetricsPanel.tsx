import type { Metrics } from "@/lib/performance";
import { minutesText } from "@/lib/time";

// مؤشرات الأداء التلقائية من المنصة
export default function MetricsPanel({ m }: { m: Metrics }) {
  const onTimeRate = m.completed ? Math.round((m.onTime / m.completed) * 100) : null;
  const items: [string, string | number, string?][] = [
    ["معاملات أُنجزت", m.completed], ["أُنجزت في موعدها", onTimeRate === null ? "—" : `${onTimeRate}%`, onTimeRate !== null && onTimeRate < 80 ? "text-amber-600" : ""],
    ["معاملات جارية حالياً", m.openNow], ["متأخرة حالياً", m.overdueNow, m.overdueNow ? "text-rose-600" : ""],
    ["الالتزام بالحضور", m.commitment === null ? "—" : `${m.commitment}%`, m.commitment !== null && m.commitment < 90 ? "text-amber-600" : ""],
    ["أيام الغياب", m.absent, m.absent ? "text-rose-600" : ""], ["مرات التأخير", `${m.lateCount} (${minutesText(m.lateMinutes)})`], ["أيام الإجازة", m.leave],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map(([l, v, c]) => (
        <div key={l} className="rounded-lg bg-neutral-50 p-3"><div className={`text-lg font-bold ${c ?? ""}`}>{v}</div><div className="text-xs text-neutral-500">{l}</div></div>
      ))}
    </div>
  );
}
