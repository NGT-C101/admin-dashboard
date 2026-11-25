import Link from "next/link";
import { ClipboardList, Handshake, Users, Wallet } from "lucide-react";
import { canAccess, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SECTIONS } from "@/lib/nav";

export default async function HomePage() {
  const user = await requireUser();
  const usersCount = await db.user.count({ where: { active: true } });

  // الأرقام دي هتتربط بالبيانات الحقيقية لما نبني كل قسم
  const stats = [
    { label: "المستخدمين النشطين", value: usersCount, icon: Users },
    { label: "العملاء النشطين", value: "—", icon: Handshake },
    { label: "الطلبات الجديدة", value: "—", icon: ClipboardList },
    { label: "فواتير متأخرة", value: "—", icon: Wallet },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">أهلاً، {user.name} 👋</h1>
        <p className="text-slate-500 mt-1">نظرة سريعة على أحوال الشركة</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Icon size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">الأقسام</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.filter((s) => canAccess(user, s.department)).map((s) => (
            <div key={s.slug} className="card p-5">
              <h3 className="font-semibold mb-3">{s.title}</h3>
              <div className="flex flex-wrap gap-2">
                {s.subs.map((sub) => (
                  <Link
                    key={sub.slug}
                    href={`/${s.slug}/${sub.slug}`}
                    className="text-xs rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                  >
                    {sub.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
