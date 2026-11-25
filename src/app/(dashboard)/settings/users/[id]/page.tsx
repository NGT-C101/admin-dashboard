import Link from "next/link";
import { notFound } from "next/navigation";
import PermissionMatrix from "@/components/PermissionMatrix";
import ActionForm from "@/components/ui/ActionForm";
import { Field } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSION_SECTIONS } from "@/lib/permissions";
import { resetUserPassword, toggleUserActive, updateAccess } from "../actions";

export default async function UserAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, include: { permissions: true, employee: { select: { id: true, fullName: true } } } });
  if (!u) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={u.name} crumbs={[{ label: "المستخدمون والصلاحيات", href: "/settings/users" }, { label: u.name }]} />
      <div className="card p-5 text-sm flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div dir="ltr" className="text-right">{u.email}</div>
          {u.employee && <Link href={`/employees/profiles/${u.employee.id}`} className="link">عرض ملف الموظف</Link>}
          {u.mustChangePassword && <div className="text-amber-700 text-xs">سيُطلب منه تغيير كلمة المرور عند الدخول</div>}
        </div>
        {u.id !== me.id && (
          <form action={toggleUserActive}>
            <input type="hidden" name="id" value={u.id} />
            <button className="btn-secondary">{u.active ? "إيقاف الحساب" : "تفعيل الحساب"}</button>
          </form>
        )}
      </div>

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">الصلاحيات</h2>
        <ActionForm action={updateAccess} submitLabel="حفظ الصلاحيات" resetOnSuccess={false}>
          <input type="hidden" name="id" value={u.id} />
          <PermissionMatrix sections={PERMISSION_SECTIONS} canGrantAdmin initialAdmin={u.role === "ADMIN"}
            initial={Object.fromEntries(u.permissions.map((p) => [p.section, p.level]))} />
        </ActionForm>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">تعيين كلمة مرور مؤقتة</h2>
        <p className="text-sm text-neutral-600">في حال نسيان كلمة المرور. سيُطلب من المستخدم تغييرها فور دخوله.</p>
        <ActionForm action={resetUserPassword} submitLabel="تعيين">
          <input type="hidden" name="id" value={u.id} />
          <Field label="كلمة المرور المؤقتة (10 أحرف على الأقل)">
            <input name="password" type="text" required minLength={10} dir="ltr" autoComplete="off" className="input max-w-sm" />
          </Field>
        </ActionForm>
      </section>
    </div>
  );
}
