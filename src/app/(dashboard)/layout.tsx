import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { canAccess, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pendingForWhere } from "@/lib/leave";
import { SECTIONS } from "@/lib/nav";
import { logout } from "../login/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // صفحة "حسابي" لازم تفضل متاحة لو المستخدم مطلوب منه يغيّر كلمة المرور
  const user = await requireUser({ allowPasswordChange: true });
  const sections = SECTIONS.filter((s) => canAccess(user, s));
  const [employee, pendingApprovals, reports] = await Promise.all([
    user.employeeId ? db.employee.findUnique({ where: { id: user.employeeId }, select: { jobTitle: true } }) : null,
    db.leaveRequest.count({ where: pendingForWhere(user) }),
    user.employeeId ? db.employee.count({ where: { managerId: user.employeeId, status: { not: "TERMINATED" } } }) : 0,
  ]);
  const teamLead = reports > 0 && !canAccess(user, SECTIONS.find((s) => s.slug === "employees")!);

  return (
    <div className="min-h-screen print:bg-white">
      <Sidebar sections={sections} isAdmin={user.isAdmin} hasEmployee={!!user.employeeId} pendingApprovals={pendingApprovals} teamLead={teamLead} />
      <div className="lg:mr-64 print:mr-0">
        <header className="print:hidden h-16 bg-white border-b border-neutral-200 flex items-center justify-end gap-4 px-4 lg:px-8">
          <div className="text-left">
            <div className="text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-neutral-500">{user.isAdmin ? "مدير النظام" : employee?.jobTitle ?? "مستخدم"}</div>
          </div>
          <Link href="/account" className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
            <KeyRound size={16} /> حسابي
          </Link>
          <form action={logout}>
            <button className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
              <LogOut size={16} /> خروج
            </button>
          </form>
        </header>
        <main className="p-4 lg:p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
