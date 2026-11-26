import type { PerformanceReview } from "@prisma/client";
import MetricsPanel from "@/components/MetricsPanel";
import { formatDateTime } from "@/lib/format";
import { CRITERIA, SCORE_LABELS, periodLabel, rating, type Metrics, type Scores } from "@/lib/performance";

// عرض تقييم مكتمل
export default function ReviewView({ r, reviewerName }: { r: PerformanceReview; reviewerName?: string }) {
  const scores = r.scores as Scores;
  const rt = rating(r.overall);
  return (
    <div className="space-y-4">
      <div className="card p-5 flex flex-wrap items-center gap-5">
        <div className="text-center">
          <div className="text-4xl font-bold text-brand-800">{r.overall.toFixed(2)}</div>
          <div className="text-xs text-neutral-500">من 5</div>
        </div>
        <div className="flex-1">
          <div className="font-semibold">{periodLabel(r.period)}</div>
          <span className={`inline-block mt-1 rounded-full px-3 py-0.5 text-sm ${rt.cls}`}>{rt.label}</span>
          {reviewerName && <div className="text-xs text-neutral-500 mt-1">المقيّم: {reviewerName}{r.submittedAt && ` · ${formatDateTime(r.submittedAt)}`}</div>}
        </div>
      </div>
      <div className="card p-5">
        <h3 className="font-semibold mb-3">المعايير</h3>
        <div className="space-y-2.5">
          {CRITERIA.map((c) => {
            const v = scores[c.key] ?? 0;
            return (
              <div key={c.key} className="flex items-center gap-3 text-sm">
                <span className="w-56 shrink-0">{c.label}</span>
                <div className="h-2 flex-1 rounded-full bg-neutral-100 overflow-hidden"><div className="h-full bg-brand-600" style={{ width: `${v * 20}%` }} /></div>
                <span className="w-24 text-left text-xs"><b>{v}</b> · {SCORE_LABELS[v]}</span>
              </div>
            );
          })}
        </div>
      </div>
      {r.metrics && <div className="card p-5"><h3 className="font-semibold mb-3">مؤشرات الفترة</h3><MetricsPanel m={r.metrics as Metrics} /></div>}
      <div className="grid gap-4 md:grid-cols-3">
        {[["نقاط القوة", r.strengths], ["مجالات التحسين", r.improvements], ["الأهداف للفترة القادمة", r.goals]].map(([l, v]) => (
          <div key={l} className="card p-4"><h3 className="font-semibold text-sm mb-2">{l}</h3><p className="text-sm text-neutral-700 whitespace-pre-line">{v || "—"}</p></div>
        ))}
      </div>
      {r.employeeComment && <div className="card p-4 border-r-4 border-brand-600"><h3 className="font-semibold text-sm mb-1">تعليق الموظف</h3><p className="text-sm whitespace-pre-line">{r.employeeComment}</p></div>}
    </div>
  );
}
