// هيكل الأقسام والأقسام الفرعية — أي قسم جديد يتضاف هنا يظهر في القائمة تلقائياً
import type { Department } from "@prisma/client";

export type SubSection = { slug: string; title: string };
export type Section = {
  slug: string;
  title: string;
  department: Department;
  icon: "users" | "handshake" | "clipboard" | "folder" | "wallet" | "megaphone";
  subs: SubSection[];
};

export const SECTIONS: Section[] = [
  {
    slug: "employees", title: "الموظفين", department: "EMPLOYEES", icon: "users",
    subs: [
      { slug: "profiles", title: "بيانات الموظفين" },
      { slug: "attendance", title: "الحضور والانصراف" },
      { slug: "leaves", title: "الإجازات والأذونات" },
      { slug: "performance", title: "تقييم الأداء" },
      { slug: "payroll", title: "الرواتب والمستحقات" },
    ],
  },
  {
    slug: "clients", title: "العملاء", department: "CLIENTS", icon: "handshake",
    subs: [
      { slug: "directory", title: "بيانات العملاء" },
      { slug: "contracts", title: "العقود والاتفاقيات" },
      { slug: "projects", title: "المشاريع الاستشارية" },
      { slug: "communications", title: "سجل التواصل والاجتماعات" },
    ],
  },
  {
    slug: "requests", title: "الطلبات", department: "REQUESTS", icon: "clipboard",
    subs: [
      { slug: "new", title: "طلبات الخدمة" },
      { slug: "quotes", title: "عروض الأسعار" },
      { slug: "tracking", title: "متابعة الطلبات" },
      { slug: "deliverables", title: "تسليم المخرجات" },
    ],
  },
  {
    slug: "admin-affairs", title: "الشؤون الإدارية", department: "ADMIN_AFFAIRS", icon: "folder",
    subs: [
      { slug: "correspondence", title: "الصادر والوارد" },
      { slug: "archive", title: "الأرشيف والمستندات" },
      { slug: "assets", title: "الأصول والعُهد" },
      { slug: "procurement", title: "المشتريات والموردين" },
    ],
  },
  {
    slug: "accounts", title: "الحسابات", department: "ACCOUNTS", icon: "wallet",
    subs: [
      { slug: "invoices", title: "الفواتير" },
      { slug: "payments", title: "المدفوعات والتحصيلات" },
      { slug: "expenses", title: "المصروفات" },
      { slug: "reports", title: "التقارير المالية" },
    ],
  },
  {
    slug: "pr", title: "العلاقات العامة", department: "PR", icon: "megaphone",
    subs: [
      { slug: "events", title: "الفعاليات والمؤتمرات" },
      { slug: "partnerships", title: "الشراكات والجهات الخارجية" },
      { slug: "campaigns", title: "الحملات والمحتوى الإعلامي" },
      { slug: "surveys", title: "استطلاعات رضا العملاء" },
    ],
  },
];

export const ROLE_LABELS = { ADMIN: "مدير النظام", MANAGER: "مدير قسم", EMPLOYEE: "موظف" } as const;

export const DEPARTMENT_LABELS: Record<Department, string> = Object.fromEntries(
  SECTIONS.map((s) => [s.department, s.title]),
) as Record<Department, string>;

export function findSection(slug: string) {
  return SECTIONS.find((s) => s.slug === slug);
}
