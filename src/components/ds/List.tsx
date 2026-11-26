import Link from "next/link";

// قائمة صفوف داخل لوحة: فواصل رفيعة، وصف كامل قابل للضغط مع تركيز واضح
export function List({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-ds-line">{children}</ul>;
}

export function ListRow({ href, leading, title, subtitle, trailing }: {
  href: string; leading?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; trailing?: React.ReactNode;
}) {
  return (
    <li>
      <Link href={href}
        className="group flex min-h-14 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-ds-hover/60 focus-visible:bg-ds-hover focus-visible:outline-none">
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ds-text">{title}</span>
          {subtitle && <span className="mt-0.5 block truncate text-[12.5px] text-ds-muted">{subtitle}</span>}
        </span>
        {trailing && <span className="shrink-0 text-[12.5px] text-ds-muted">{trailing}</span>}
      </Link>
    </li>
  );
}
