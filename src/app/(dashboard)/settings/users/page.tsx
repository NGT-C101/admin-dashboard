import Link from "next/link";
import AccessSummary from "@/components/AccessSummary";
import PermissionMatrix from "@/components/PermissionMatrix";
import ActionForm from "@/components/ui/ActionForm";
import Collapsible from "@/components/ui/Collapsible";
import { Field, FieldGrid } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSION_SECTIONS } from "@/lib/permissions";
import { createAccount } from "./actions";

export default async function UsersPage() {
  await requireAdmin();
  const users = await db.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { permissions: true, employee: { select: { id: true, jobTitle: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="المستخدمون والصلاحيات" crumbs={[{ label: "الإعدادات" }, { label: "المستخدمون والصلاحيات" }]} />
      <p className="text-sm text-neutral-600">
        يُنشأ حساب الدخول للموظفين عادةً من <Link href="/employees/profiles/new" className="link">إضافة موظف</Link>.
        استخدم هذه الصفحة لمراجعة صلاحيات الجميع، أو لإنشاء حساب مستقل لا يرتبط بملف موظف.
      </p>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>المستخدم</th><th>البريد الإلكتروني</th><th>الصلاحيات</th><th>الحالة</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td>
                  <Link href={`/settings/users/${u.id}`} className="link">{u.name}</Link>
                  <div className="text-xs text-neutral-500">
                    {u.employee ? <Link href={`/employees/profiles/${u.employee.id}`} className="hover:underline">{u.employee.jobTitle}</Link> : "حساب مستقل"}
                  </div>
                </td>
                <td dir="ltr" className="text-right">{u.email}</td>
                <td><AccessSummary isAdmin={u.role === "ADMIN"} perms={u.permissions} /></td>
                <td>
                  {u.active ? <span className="text-xs text-emerald-700">نشط</span> : <span className="text-xs text-neutral-500">موقوف</span>}
                  {u.autoAssign && <div className="text-xs text-sky-700">مدرج في التوزيع</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Collapsible label="إنشاء حساب مستقل">
        <ActionForm action={createAccount} submitLabel="إنشاء الحساب">
          <FieldGrid>
            <Field label="الاسم"><input name="name" required className="input" /></Field>
            <Field label="البريد الإلكتروني"><input name="email" type="email" required dir="ltr" className="input" /></Field>
            <Field label="كلمة مرور مؤقتة (10 أحرف على الأقل)"><input name="password" type="text" required minLength={10} dir="ltr" autoComplete="off" className="input" /></Field>
          </FieldGrid>
          <PermissionMatrix sections={PERMISSION_SECTIONS} canGrantAdmin />
        </ActionForm>
      </Collapsible>
    </div>
  );
}
