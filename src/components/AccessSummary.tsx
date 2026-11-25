import { ShieldCheck } from "lucide-react";
import type { Department, PermLevel } from "@prisma/client";
import { DEPARTMENT_LABELS } from "@/lib/nav";

const STYLE: Record<PermLevel, string> = {
  VIEW: "bg-neutral-100 text-neutral-700",
  EDIT: "bg-sky-50 text-sky-800",
  MANAGE: "bg-brand-50 text-brand-800",
};
const SHORT: Record<PermLevel, string> = { VIEW: "عرض", EDIT: "تعديل", MANAGE: "إدارة" };

// ملخص الصلاحيات بشكل شارات صغيرة
export default function AccessSummary({ isAdmin, perms }: { isAdmin: boolean; perms: { section: Department; level: PermLevel }[] }) {
  if (isAdmin) return <span className="inline-flex items-center gap-1 rounded-full bg-brand-700 px-2.5 py-0.5 text-xs text-white"><ShieldCheck size={12} /> مدير النظام</span>;
  if (perms.length === 0) return <span className="text-xs text-neutral-400">بدون صلاحيات</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {perms.map((p) => (
        <span key={p.section} className={`rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap ${STYLE[p.level]}`}>
          {DEPARTMENT_LABELS[p.section]}: {SHORT[p.level]}
        </span>
      ))}
    </div>
  );
}
