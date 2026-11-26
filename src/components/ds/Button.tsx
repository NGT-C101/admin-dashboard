import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";

// ثلاثة أنواع فقط: أساسي (أحمر NGT، إجراء واحد في الشاشة)، ثانوي (سطح بحد)، شفاف (روابط ثانوية)
type Variant = "primary" | "secondary" | "ghost";
const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ds-control font-medium transition-[background-color,color,box-shadow] duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-canvas disabled:opacity-50";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-ds-primary text-white shadow-ds-button hover:bg-ds-primary-hover",
  secondary: "border border-ds-line-strong bg-ds-raised text-ds-text hover:bg-ds-hover",
  ghost: "text-ds-muted hover:bg-ds-hover hover:text-ds-text",
};
const SIZES = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm" };

export function buttonClass(variant: Variant = "secondary", size: keyof typeof SIZES = "md") {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}

export function ButtonLink({ href, children, variant = "secondary", size = "md", icon }: {
  href: string; children: React.ReactNode; variant?: Variant; size?: keyof typeof SIZES; icon?: LucideIcon;
}) {
  return <Link href={href} className={buttonClass(variant, size)}>{icon && <Icon icon={icon} />}{children}</Link>;
}
