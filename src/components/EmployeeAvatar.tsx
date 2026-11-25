import { initials } from "@/lib/hr";

// صورة رمزية بالأحرف الأولى، ولونها ثابت لكل اسم
const COLORS = ["from-brand-700 to-brand-900", "from-neutral-600 to-neutral-800", "from-brand-500 to-brand-700", "from-[#8a6d3b] to-[#5c4724]", "from-[#3f5f74] to-[#24394a]"];

export default function EmployeeAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const cls = size === "lg" ? "w-20 h-20 text-2xl" : size === "sm" ? "w-8 h-8 text-xs" : "w-12 h-12 text-base";
  return (
    <div className={`${cls} shrink-0 rounded-full bg-gradient-to-br ${COLORS[hash % COLORS.length]} text-white font-bold flex items-center justify-center shadow-sm`}>
      {initials(name)}
    </div>
  );
}
