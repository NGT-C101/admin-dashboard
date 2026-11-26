import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Icon } from "./Icon";

// اللوحة: السطح الوحيد المرفوع في الصفحة. ترويسة بعنوان وعدد أو رابط أو وصف قصير، ثم محتوى بلا حشو
export function Panel({ title, count, href, hrefLabel = "عرض الكل", meta, className = "", children }: {
  title: string; count?: number; href?: string; hrefLabel?: string; meta?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-ds-panel border border-ds-line bg-ds-surface shadow-ds-panel ${className}`}>
      <header className="flex min-h-13 items-center justify-between gap-3 border-b border-ds-line px-5">
        <h2 className="flex items-center gap-2 font-heading text-[15px] font-medium text-ds-text">
          {title}
          {count !== undefined && count > 0 && (
            <span className="rounded-md bg-ds-accent-soft px-1.5 text-xs font-semibold text-ds-accent tabular-nums">{count}</span>
          )}
        </h2>
        {href && (
          <Link href={href} className="flex items-center gap-1 rounded-md text-[13px] text-ds-muted transition-colors hover:text-ds-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent">
            {hrefLabel} <Icon icon={ArrowLeft} size={16} />
          </Link>
        )}
        {meta && <span className="text-[12.5px] text-ds-faint">{meta}</span>}
      </header>
      {children}
    </section>
  );
}

// حالة فارغة: جملة تقول ما سيظهر هنا وكيف يبدأ
export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm leading-relaxed text-ds-muted">{children}</p>;
}
