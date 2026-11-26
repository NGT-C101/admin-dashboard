import { useId } from "react";

// شريط زخرفة مستوحى من نسيج السدو — يُستخدم في مواضع محددة فقط (القائمة، الدخول، التقارير)
const TONES = {
  dark: { diamond: "#7D0000", core: "#D8C3A5" }, // على خلفية عنابي الليل
  bright: { diamond: "#B10302", core: "#D8C3A5" }, // أبرز على الغامق
  light: { diamond: "#D8C3A5", core: "#B10302" }, // على الخلفيات الفاتحة
} as const;

export default function SaduBand({ tone = "dark", size = 12, className = "" }: {
  tone?: keyof typeof TONES; size?: number; className?: string;
}) {
  const id = `sadu-${useId().replace(/:/g, "")}`;
  const t = TONES[tone];
  const w = Math.round(size * 1.7);
  const mid = size / 2;
  return (
    <svg width="100%" height={size} aria-hidden="true" className={`block ${className}`}>
      <defs>
        <pattern id={id} width={w} height={size} patternUnits="userSpaceOnUse">
          <polygon points={`${w / 2},1 ${w - 2},${mid} ${w / 2},${size - 1} 2,${mid}`} fill={t.diamond} />
          <polygon points={`${w / 2},${mid - size / 6} ${w / 2 + w / 7},${mid} ${w / 2},${mid + size / 6} ${w / 2 - w / 7},${mid}`} fill={t.core} />
        </pattern>
      </defs>
      <rect width="100%" height={size} fill={`url(#${id})`} />
    </svg>
  );
}
