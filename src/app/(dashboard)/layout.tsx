import { LogOut } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { canAccess, requireUser } from "@/lib/auth";
import { DEPARTMENT_LABELS, ROLE_LABELS, SECTIONS } from "@/lib/nav";
import { logout } from "../login/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const sections = SECTIONS.filter((s) => canAccess(user, s));

  return (
    <div className="min-h-screen">
      <Sidebar sections={sections} isAdmin={user.role === "ADMIN"} />
      <div className="lg:mr-64">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end gap-4 px-4 lg:px-8">
          <div className="text-left">
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-slate-500">
              {ROLE_LABELS[user.role]}
              {user.department && ` · ${DEPARTMENT_LABELS[user.department]}`}
            </div>
          </div>
          <form action={logout}>
            <button className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
              <LogOut size={16} /> خروج
            </button>
          </form>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
