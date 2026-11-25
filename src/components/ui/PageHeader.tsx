import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type Crumb = { label: string; href?: string };

export default function PageHeader({
  title, crumbs, actions,
}: { title: string; crumbs?: Crumb[]; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {crumbs && (
          <nav className="flex items-center gap-1 text-sm text-slate-500 mb-1">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {c.href ? <Link href={c.href} className="hover:text-teal-700">{c.label}</Link> : c.label}
                {i < crumbs.length - 1 && <ChevronLeft size={14} />}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
