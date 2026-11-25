import ActionForm from "@/components/ui/ActionForm";
import LoginFields from "@/components/LoginFields";
import PageHeader from "@/components/ui/PageHeader";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSION_SECTIONS } from "@/lib/permissions";
import { createEmployee } from "../../actions";
import { ContactFields, FormSection, IdentityFields, JobFields, PersonalFields, SalaryFields } from "../../fields";

export default async function NewEmployeePage() {
  const user = await requireSection("employees", "EDIT");
  const managers = await db.employee.findMany({
    where: { status: { not: "TERMINATED" } }, select: { id: true, fullName: true, jobTitle: true }, orderBy: { fullName: "asc" },
  });
  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader title="إضافة موظف" crumbs={[{ label: "سجل الموظفين", href: "/employees/profiles" }, { label: "إضافة موظف" }]} />
      <ActionForm action={createEmployee} submitLabel="حفظ الموظف" className="space-y-5">
        <FormSection title="البيانات الشخصية"><PersonalFields /></FormSection>
        <FormSection title="الهوية والجواز" hint="تُستخدم للتنبيه قبل انتهاء الإقامة أو الجواز بـ 60 يوماً"><IdentityFields /></FormSection>
        <FormSection title="بيانات التواصل"><ContactFields /></FormSection>
        <FormSection title="البيانات الوظيفية"><JobFields managers={managers} /></FormSection>
        {can(user, "employees", "MANAGE") && (
          <FormSection title="الراتب والحساب البنكي" hint="بيانات سرية لا تظهر إلا لمن لديه صلاحية الإدارة الكاملة على قسم الموظفين"><SalaryFields /></FormSection>
        )}
        {user.isAdmin && (
          <FormSection title="حساب الدخول والصلاحيات" hint="حدد ما يمكن للموظف الاطلاع عليه وتعديله في كل قسم">
            <LoginFields sections={PERMISSION_SECTIONS} />
          </FormSection>
        )}
      </ActionForm>
    </div>
  );
}
