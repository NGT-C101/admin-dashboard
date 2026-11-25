import Link from "next/link";

// تبويبات بتتغيّر من الرابط (?tab=...)
export default function Tabs({ base, current, tabs }: {
  base: string;
  current: string;
  tabs: { key: string; label: string; count?: number }[];
}) {
  return (
    <div className="border-b border-neutral-200 overflow-x-auto">
      <nav className="flex gap-1 min-w-max">
        {tabs.map((t) => {
          const active = t.key === current;
          return (
            <Link key={t.key} href={t.key === tabs[0].key ? base : `${base}?tab=${t.key}`} scroll={false}
              className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition ${
                active ? "border-brand-600 text-brand-800 font-semibold" : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}>
              {t.label}
              {t.count !== undefined && (
                <span className={`mr-1.5 rounded-full px-1.5 text-xs ${active ? "bg-brand-50" : "bg-neutral-100"}`}>{t.count}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
