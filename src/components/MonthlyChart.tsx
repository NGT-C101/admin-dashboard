// رسم شهري لحركة المعاملات: أعمدة للمعاملات الجديدة وخط للمكتملة (نفس الوحدة ونفس المحور)
// الزمن يتجه من اليمين إلى اليسار (الأقدم يميناً) بما يناسب القراءة العربية

export type MonthPoint = { key: string; short: string; label: string; created: number; done: number };

const PAD_T = 12, PAD_B = 30, PAD_R = 34, PAD_L = 6;

function niceMax(v: number) {
  if (v <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= v) return m * step;
  return 10 * step;
}

// عمود بحواف علوية دائرية 4px ومثبّت على خط الأساس
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x} ${y + h} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h} Z`;
}

// tone="dark" للوحات الداكنة: نفس الرسم بألوان شبكة ونصوص مناسبة للخلفية الكحلية
const TONES = {
  light: { grid: "#e4ddd3", text: "#71675e", bar: "var(--color-chart-1)", line: "var(--color-chart-2)", ring: "#ffffff" },
  dark: { grid: "rgba(255,255,255,0.08)", text: "#8592b5", bar: "#5b7fd6", line: "#d4a548", ring: "#0b1733" },
} as const;

// W × H = أبعاد الرسم بوحدات viewBox (480×240 افتراضياً؛ أعرض في اللوحات العريضة ليبقى حجم الخط ثابتاً)
export default function MonthlyChart({ data, tone = "light", W = 480, H = 240 }: { data: MonthPoint[]; tone?: keyof typeof TONES; W?: number; H?: number }) {
  const c = TONES[tone];
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.created, d.done])));
  const plotW = W - PAD_R - PAD_L, plotH = H - PAD_T - PAD_B;
  const band = plotW / data.length;
  const barW = Math.min(22, band * 0.5);
  // الشهر الأقدم في أقصى اليمين
  const cx = (i: number) => W - PAD_R - band * (i + 0.5);
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const line = data.map((d, i) => `${i ? "L" : "M"}${cx(i)} ${y(d.done)}`).join(" ");

  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: c.bar }} aria-hidden="true" /> معاملات جديدة</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: c.line }} aria-hidden="true" /><span className="-mr-3 size-2 rounded-full border-2" style={{ background: c.line, borderColor: c.ring }} aria-hidden="true" /> معاملات مكتملة</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="حركة المعاملات الشهرية خلال آخر 12 شهراً">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke={c.grid} strokeWidth="1" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={W - PAD_R + 8} y={y(t) + 4} fontSize="12" fill={c.text} textAnchor="start">{t}</text>
          </g>
        ))}
        {data.map((d, i) => (
          <path key={d.key} d={barPath(cx(i) - barW / 2, y(d.created), barW, y(0) - y(d.created))} fill={c.bar} />
        ))}
        <path d={line} fill="none" stroke={c.line} strokeWidth="2" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={d.key} cx={cx(i)} cy={y(d.done)} r="4" fill={c.line} stroke={c.ring} strokeWidth="2" />
        ))}
        {/* اسم الشهر لكل شهرين حتى لا تتزاحم التسميات، والتفاصيل في التلميح والجدول */}
        {data.map((d, i) => (i % 2 === data.length % 2 ? null : (
          <text key={d.key} x={cx(i)} y={H - 10} fontSize="12" fill={c.text} textAnchor="middle">{d.short}</text>
        )))}
        {/* منطقة تمرير لكل شهر تعرض التفاصيل */}
        {data.map((d, i) => (
          <rect key={d.key} x={cx(i) - band / 2} y={PAD_T} width={band} height={plotH} fill="transparent" className="hover:fill-navy-500/10">
            <title>{`${d.label}: ${d.created} جديدة · ${d.done} مكتملة`}</title>
          </rect>
        ))}
      </svg>
      <details className="text-xs text-neutral-600">
        <summary className="cursor-pointer select-none">عرض البيانات كجدول</summary>
        <table className="table mt-2">
          <thead><tr><th>الشهر</th><th>معاملات جديدة</th><th>معاملات مكتملة</th></tr></thead>
          <tbody>
            {data.map((d) => <tr key={d.key}><td>{d.label}</td><td className="tabular-nums">{d.created}</td><td className="tabular-nums">{d.done}</td></tr>)}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
