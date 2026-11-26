import { useId } from "react";

// مشهد أفق الرياض ليلاً (برج المملكة، الفيصلية، وأبراج بنوافذ مضيئة) — رسم متجهي بدون صور خارجية

// مولّد أرقام ثابت حتى يكون الرسم متطابقاً بين الخادم والمتصفح
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Tower = { x: number; w: number; h: number; windows: { x: number; y: number; o: number }[] };

function buildTowers(seed: number, count: number, minH: number, maxH: number, skip: [number, number][]): Tower[] {
  const r = seeded(seed);
  const out: Tower[] = [];
  let x = 0;
  while (x < 1600 && out.length < count) {
    const w = 26 + Math.round(r() * 34);
    const h = minH + Math.round(r() * (maxH - minH));
    if (!skip.some(([a, b]) => x + w > a && x < b)) {
      const windows: Tower["windows"] = [];
      for (let wy = 500 - h + 10; wy < 488; wy += 11) {
        for (let wx = x + 5; wx < x + w - 5; wx += 8) {
          if (r() > 0.65) windows.push({ x: wx, y: wy, o: 0.35 + r() * 0.6 });
        }
      }
      out.push({ x, w, h, windows });
    }
    x += w + 4 + Math.round(r() * 10);
  }
  return out;
}

const FAR = buildTowers(7, 80, 60, 170, []);
const NEAR = buildTowers(41, 60, 80, 260, [[690, 820], [450, 560]]);

export default function Skyline({ sky = true, className = "" }: { sky?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 1600 500" preserveAspectRatio="xMidYMax slice" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070f24" />
          <stop offset="0.45" stopColor="#1b2457" />
          <stop offset="0.75" stopColor="#5b3a6e" />
          <stop offset="1" stopColor="#d98c4a" />
        </linearGradient>
        <linearGradient id={`glow${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0d08a" stopOpacity="0" />
          <stop offset="1" stopColor="#f0d08a" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={`tower${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2e5c" />
          <stop offset="1" stopColor="#0b1733" />
        </linearGradient>
        <linearGradient id={`kc${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3d5288" />
          <stop offset="0.5" stopColor="#8396c4" />
          <stop offset="1" stopColor="#2a3f73" />
        </linearGradient>
      </defs>

      {sky && <rect width="1600" height="500" fill={`url(#sky${id})`} />}
      <rect y="380" width="1600" height="120" fill={`url(#glow${id})`} />

      {/* الصف البعيد */}
      <g fill="#16224a" opacity="0.85">
        {FAR.map((t, i) => <rect key={i} x={t.x} y={500 - t.h} width={t.w} height={t.h} />)}
      </g>

      {/* الفيصلية */}
      <g>
        <path d="M470 500 L505 175 L540 500 Z" fill={`url(#tower${id})`} stroke="#3d5288" strokeWidth="1" />
        <circle cx="505" cy="250" r="11" fill="#e5bb63" />
        <path d="M505 175 L505 120" stroke="#8396c4" strokeWidth="2" />
      </g>

      {/* برج المملكة */}
      <g>
        <path
          fillRule="evenodd"
          fill={`url(#kc${id})`}
          d="M712 500 L720 190 C728 120 748 70 755 58 C762 70 782 120 790 190 L798 500 Z
             M733 175 C738 125 750 98 755 92 C760 98 772 125 777 175 Z"
        />
        <path d="M736 150 L774 150" stroke="#f0d08a" strokeWidth="2.5" />
        <path d="M755 92 L755 58" stroke="#f0d08a" strokeWidth="1" opacity="0.6" />
      </g>

      {/* الصف القريب بنوافذ مضيئة */}
      {NEAR.map((t, i) => (
        <g key={i}>
          <rect x={t.x} y={500 - t.h} width={t.w} height={t.h} fill={`url(#tower${id})`} />
          {t.windows.map((w, j) => <rect key={j} x={w.x} y={w.y} width="3" height="4" fill="#f0d08a" opacity={w.o} />)}
        </g>
      ))}
    </svg>
  );
}
