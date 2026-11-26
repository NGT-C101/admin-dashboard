import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";

// مجموعة مؤشرات في لوحة واحدة مقسّمة؛ آخر صف يتمدد ليملأ العرض مهما كان العدد
export function StatGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="overflow-hidden rounded-ds-panel border border-ds-line shadow-ds-panel">
      <div className="flex flex-wrap gap-px bg-ds-line">{children}</div>
    </section>
  );
}

export function Stat({ label, value, href, icon, alert }: { label: string; value: number | string; href: string; icon: LucideIcon; alert?: boolean }) {
  return (
    <Link href={href}
      className="group flex min-w-[9.5rem] flex-1 basis-[calc(20%-1px)] flex-col gap-3 bg-ds-surface px-5 py-4 transition-colors hover:bg-ds-raised focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ds-accent">
      <span className="flex items-center justify-between gap-2 text-[13px] text-ds-muted">
        <span className="truncate">{label}</span>
        <Icon icon={icon} className="text-ds-faint transition-colors group-hover:text-ds-muted" />
      </span>
      <span className={`font-heading text-[26px] font-medium leading-none tabular-nums ${alert ? "text-ds-danger" : "text-ds-text"}`}>{value}</span>
    </Link>
  );
}
