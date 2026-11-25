import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEPARTMENT_LABELS, ROLE_LABELS } from "@/lib/nav";
import ActionForm from "@/components/ui/ActionForm";
import { resetUserPassword, toggleUserActive } from "./actions";
import UserForm from "./UserForm";

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">المستخدمين والصلاحيات</h1>
      <UserForm />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="text-right font-medium p-3">الاسم</th>
              <th className="text-right font-medium p-3">البريد</th>
              <th className="text-right font-medium p-3">الدور</th>
              <th className="text-right font-medium p-3">القسم</th>
              <th className="text-right font-medium p-3">الحالة</th>
              <th className="text-right font-medium p-3">كلمة مرور جديدة</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-neutral-100">
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3" dir="ltr">{u.email}</td>
                <td className="p-3">{ROLE_LABELS[u.role]}</td>
                <td className="p-3">{u.department ? DEPARTMENT_LABELS[u.department] : "كل الأقسام"}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${u.active ? "bg-brand-50 text-brand-700" : "bg-neutral-100 text-neutral-500"}`}>
                    {u.active ? "نشط" : "موقوف"}
                  </span>
                </td>
                <td className="p-3">
                  {u.id !== me.id && (
                    <ActionForm action={resetUserPassword} submitLabel="حفظ" className="flex items-center gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <input name="password" type="password" minLength={8} required dir="ltr" autoComplete="new-password" className="input w-36" />
                    </ActionForm>
                  )}
                </td>
                <td className="p-3 text-left">
                  {u.id !== me.id && (
                    <form action={toggleUserActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className="text-xs text-neutral-600 hover:text-brand-700 underline">
                        {u.active ? "إيقاف" : "تفعيل"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
