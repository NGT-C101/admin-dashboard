import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import { Field } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PERM_LEVEL_LABELS, serviceText } from "@/lib/hr";
import { DEPARTMENT_LABELS } from "@/lib/nav";
import { changePassword } from "./actions";

export default async function AccountPage() {
  const user = await requireUser({ allowPasswordChange: true });
  const employee = user.employeeId
    ? await db.employee.findUnique({ where: { id: user.employeeId }, include: { manager: { select: { fullName: true } } } })
    : null;
  const perms = Object.entries(user.perms);

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="حسابي" />
      {user.mustChangePassword && (
        <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <ShieldAlert className="shrink-0" />
          <div>
            <p className="font-semibold">مرحباً بك في المنصة</p>
            <p className="text-sm">لحماية حسابك، يرجى تعيين كلمة مرور جديدة خاصة بك قبل المتابعة.</p>
          </div>
        </div>
      )}
      <div className="card p-5 text-sm space-y-2">
        <div><span className="text-neutral-500">الاسم: </span><b>{user.name}</b></div>
        <div><span className="text-neutral-500">البريد الإلكتروني: </span><span dir="ltr">{user.email}</span></div>
        {employee && (
          <>
            <div><span className="text-neutral-500">المسمى الوظيفي: </span>{employee.jobTitle}{employee.orgDepartment && ` — ${employee.orgDepartment}`}</div>
            <div><span className="text-neutral-500">الرقم الوظيفي: </span><span dir="ltr">EMP-{String(employee.number).padStart(4, "0")}</span></div>
            {employee.manager && <div><span className="text-neutral-500">المدير المباشر: </span>{employee.manager.fullName}</div>}
            <div><span className="text-neutral-500">تاريخ الالتحاق: </span>{formatDate(employee.hireDate)} ({serviceText(employee.hireDate)})</div>
          </>
        )}
        <div className="pt-2 border-t border-neutral-100">
          <span className="text-neutral-500">الصلاحيات: </span>
          {user.isAdmin ? <b>مدير النظام (جميع الصلاحيات)</b>
            : perms.length === 0 ? "لا توجد صلاحيات على الأقسام"
            : perms.map(([d, l]) => `${DEPARTMENT_LABELS[d as keyof typeof DEPARTMENT_LABELS]}: ${PERM_LEVEL_LABELS[l!]}`).join(" · ")}
        </div>
        {employee && user.isAdmin === false && (
          <p className="text-xs text-neutral-500">لتحديث بياناتك الوظيفية يرجى التواصل مع إدارة الموارد البشرية.</p>
        )}
      </div>
      <div className="card p-5">
        <h2 className="font-semibold mb-4">تغيير كلمة المرور</h2>
        <ActionForm action={changePassword} submitLabel="تغيير كلمة المرور">
          <Field label="كلمة المرور الحالية">
            <input name="current" type="password" required dir="ltr" autoComplete="current-password" className="input" />
          </Field>
          <Field label="كلمة المرور الجديدة (10 أحرف على الأقل)">
            <input name="next" type="password" required minLength={10} dir="ltr" autoComplete="new-password" className="input" />
          </Field>
          <Field label="تأكيد كلمة المرور الجديدة">
            <input name="confirm" type="password" required minLength={10} dir="ltr" autoComplete="new-password" className="input" />
          </Field>
        </ActionForm>
      </div>
      {!user.mustChangePassword && <Link href="/" className="text-sm link">← العودة إلى الرئيسية</Link>}
    </div>
  );
}
