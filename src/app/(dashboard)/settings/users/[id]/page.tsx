import Link from "next/link";
import { notFound } from "next/navigation";
import PermissionMatrix from "@/components/PermissionMatrix";
import ActionForm from "@/components/ui/ActionForm";
import { Field } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSION_SECTIONS } from "@/lib/permissions";
import { resetUserPassword, saveAutoAssign, toggleUserActive, updateAccess } from "../actions";

export default async function UserAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const [u, services, openCount] = await Promise.all([
    db.user.findUnique({
      where: { id },
      include: { permissions: true, employee: { select: { id: true, fullName: true } }, assignableServices: { select: { id: true } } },
    }),
    db.serviceType.findMany({ where: { active: true }, orderBy: [{ govEntity: { order: "asc" } }, { order: "asc" }], include: { govEntity: { select: { name: true } } } }),
    db.transaction.count({ where: { assigneeId: id, stage: { kind: "OPEN" } } }),
  ]);
  if (!u) notFound();
  const mine = new Set(u.assignableServices.map((s) => s.id));
  const groups = Object.entries(Object.groupBy(services, (s) => s.govEntity?.name ?? "خدمات عامة"));

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
        <h2 className="font-semibold">التوزيع التلقائي للمعاملات</h2>
        <p className="text-sm text-neutral-600">
          المعاملة الجديدة تُسند تلقائياً إلى الموظف المدرج الأقل معاملات جارية ممن يتولّون خدمتها.
          لديه الآن {openCount} معاملة جارية.
        </p>
        <ActionForm action={saveAutoAssign} submitLabel="حفظ" resetOnSuccess={false}>
          <input type="hidden" name="id" value={u.id} />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="autoAssign" defaultChecked={u.autoAssign} className="size-4 accent-brand-600" />
            مدرج في التوزيع التلقائي
          </label>
          <div className="space-y-2">
            <p className="text-sm">الخدمات التي يتولاها <span className="text-neutral-500">(إذا لم تُحدَّد أي خدمة فإنه يتولى كل الخدمات)</span> — المحدد حالياً: {mine.size || "كل الخدمات"}</p>
            {groups.map(([group, list]) => {
              const n = list!.filter((s) => mine.has(s.id)).length;
              return (
                <details key={group} className="rounded-lg border border-neutral-200 px-3 py-2">
                  <summary className="cursor-pointer select-none text-sm">{group} {n > 0 && <span className="text-brand-700">({n})</span>}</summary>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {list!.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={mine.has(s.id)} className="size-4 accent-brand-600" />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
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
