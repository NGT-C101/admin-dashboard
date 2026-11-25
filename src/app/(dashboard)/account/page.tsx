import ActionForm from "@/components/ui/ActionForm";
import { Field } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth";
import { DEPARTMENT_LABELS, ROLE_LABELS } from "@/lib/nav";
import { changePassword } from "./actions";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="حسابي" />
      <div className="card p-5 text-sm space-y-1">
        <div><span className="text-slate-500">الاسم: </span>{user.name}</div>
        <div><span className="text-slate-500">البريد: </span><span dir="ltr">{user.email}</span></div>
        <div>
          <span className="text-slate-500">الدور: </span>{ROLE_LABELS[user.role]}
          {user.department && ` · ${DEPARTMENT_LABELS[user.department]}`}
        </div>
      </div>
      <div className="card p-5">
        <h2 className="font-semibold mb-4">تغيير كلمة المرور</h2>
        <ActionForm action={changePassword} submitLabel="تغيير كلمة المرور">
          <Field label="كلمة المرور الحالية">
            <input name="current" type="password" required dir="ltr" autoComplete="current-password" className="input" />
          </Field>
          <Field label="كلمة المرور الجديدة (10 حروف على الأقل)">
            <input name="next" type="password" required minLength={10} dir="ltr" autoComplete="new-password" className="input" />
          </Field>
          <Field label="تأكيد كلمة المرور الجديدة">
            <input name="confirm" type="password" required minLength={10} dir="ltr" autoComplete="new-password" className="input" />
          </Field>
        </ActionForm>
      </div>
    </div>
  );
}
