import type { LucideIcon } from "lucide-react";

// أيقونة موحّدة: نفس سُمك الخط في كل المنصة، وحجمان فقط (16 داخل النص، 18 في التنقل)
export function Icon({ icon: I, size = 16, className = "", label }: { icon: LucideIcon; size?: 16 | 18 | 20; className?: string; label?: string }) {
  return <I size={size} strokeWidth={1.75} absoluteStrokeWidth className={`shrink-0 ${className}`} aria-hidden={label ? undefined : true} aria-label={label} />;
}
