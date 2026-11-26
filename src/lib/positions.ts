import type { PositionLevel } from "@prisma/client";

export const POSITION_LEVEL_LABELS: Record<PositionLevel, string> = {
  EXECUTIVE: "الإدارة التنفيذية",
  SENIOR: "الإدارة العليا",
  DEPARTMENT: "مديرو الأقسام",
};
export const POSITION_LEVEL_STYLES: Record<PositionLevel, string> = {
  EXECUTIVE: "from-brand-800 to-brand-950 text-white",
  SENIOR: "from-brand-600 to-brand-800 text-white",
  DEPARTMENT: "from-white to-neutral-50 text-neutral-900",
};
