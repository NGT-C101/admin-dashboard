import DateField, { MonthField } from "@/components/ui/DateField";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, CalendarDays, Hash, Mail, MessageCircle, Phone, UserRound } from "lucide-react";
import AccessSummary from "@/components/AccessSummary";
import DocumentsSection from "@/components/DocumentsSection";
import EmployeeAvatar from "@/components/EmployeeAvatar";
import HrAlertsList from "@/components/HrAlertsList";
import LoginFields from "@/components/LoginFields";
import PermissionMatrix from "@/components/PermissionMatrix";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import { Field, FieldGrid } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { can, requireSection } from "@/lib/auth";
import { daysText, daysUntil, whatsappLink } from "@/lib/clients";
import { db } from "@/lib/db";
import { dateInputValue, formatDate, formatSAR } from "@/lib/format";
import {
  EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_STYLES, EMPLOYMENT_TYPE_LABELS, GENDER_LABELS, TERMINATION_REASONS,
  endOfServiceBenefit, formatIban, serviceParts, serviceText, totalWage, type TerminationReason,
} from "@/lib/hr";
import { getHrAlerts } from "@/lib/hr-alerts";
import { loadLeaders } from "@/lib/leaders";
import { PERMISSION_SECTIONS } from "@/lib/permissions";
import LeaveBalanceCard from "@/components/LeaveBalanceCard";
import MonthAttendance from "@/components/MonthAttendance";
import RequestsTable, { REQUEST_INCLUDE } from "@/components/RequestsTable";
import { currentMonthKey } from "@/lib/time";
import { REVIEW_STATUS_LABELS, currentPeriod, periodLabel, rating } from "@/lib/performance";
import { updateAccess } from "@/app/(dashboard)/settings/users/actions";
import { grantLogin, reinstateEmployee, setEmployeeStatus, terminateEmployee, updateEmployee, updateSalary } from "../../actions";
import { ContactFields, IdentityFields, JobFields, PersonalFields, SalaryFields } from "../../fields";

const empNo = (n: number) => `EMP-${String(n).padStart(4, "0")}`;

function Expiry({ date }: { date: Date | null }) {
  if (!date) return <>—</>;
  const d = daysUntil(date);
  return (
    <span className={d < 0 ? "text-rose-600" : d <= 60 ? "text-amber-600" : ""}>
      {formatDate(date)}{d < 0 ? " (منتهٍ)" : d <= 60 ? ` (متبقٍ ${daysText(d)})` : ""}
    </span>
  );
}

function InfoGrid({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([l, v]) => <div key={l}><dt className="text-xs text-neutral-500">{l}</dt><dd className="font-medium">{v || "—"}</dd></div>)}
    </dl>
  );
}

export default async function EmployeePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const user = await requireSection("employees");
  const { id } = await params;
  const sp = await searchParams;
  const canEdit = can(user, "employees", "EDIT");
  const canManage = can(user, "employees", "MANAGE");

  const e = await db.employee.findUnique({
    where: { id },
    include: {
      manager: { select: { id: true, fullName: true, jobTitle: true } },
      reports: { where: { status: { not: "TERMINATED" } }, select: { id: true, fullName: true, jobTitle: true }, orderBy: { fullName: "asc" } },
      user: { include: { permissions: true } },
      position: { select: { title: true } },
      _count: { select: { documents: true } },
    },
  });
  if (!e) notFound();

  const tabs = [
    { key: "overview", label: "البيانات الشخصية" },
    { key: "job", label: "البيانات الوظيفية" },
    ...(canEdit ? [{ key: "leave", label: "الإجازات والحضور" }, { key: "performance", label: "الأداء" }] : []),
    ...(canManage ? [{ key: "salary", label: "الراتب ومستحقات الخدمة" }, { key: "documents", label: "المستندات", count: e._count.documents }] : []),
    ...(user.isAdmin ? [{ key: "access", label: "حساب الدخول والصلاحيات" }] : []),
  ];
  const tab = tabs.some((t) => t.key === sp.tab) ? sp.tab! : "overview";
  const base = `/employees/profiles/${id}`;
  const wa = whatsappLink(e.phone);
  const alerts = (await getHrAlerts()).filter((a) => a.employeeId === id);

  return (
    <div className="space-y-6">
      <PageHeader title="ملف الموظف" crumbs={[{ label: "سجل الموظفين", href: "/employees/profiles" }, { label: e.fullName }]} />

      {/* بطاقة الموظف */}
      <div className="card overflow-hidden">
        <div className="h-20 bg-gradient-to-l from-brand-950 via-brand-900 to-brand-800" />
        <div className="px-6 pb-5 -mt-10 flex flex-wrap items-end gap-5">
          <div className="rounded-full ring-4 ring-white"><EmployeeAvatar name={e.fullName} size="lg" /></div>
          <div className="flex-1 min-w-56 pt-12">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{e.fullName}</h1>
              <Badge className={EMPLOYEE_STATUS_STYLES[e.status]}>{EMPLOYEE_STATUS_LABELS[e.status]}</Badge>
              {e.position && <Badge className="bg-brand-700 text-white ring-brand-700">{e.position.title}</Badge>}
            </div>
            {e.fullNameEn && <p className="text-sm text-neutral-500" dir="ltr">{e.fullNameEn}</p>}
            <p className="text-neutral-700">{e.jobTitle}{e.orgDepartment && <span className="text-neutral-500"> — {e.orgDepartment}</span>}</p>
          </div>
          <div className="flex gap-2">
            {wa && <a href={wa} target="_blank" rel="noopener" className="btn-secondary"><MessageCircle size={16} className="text-emerald-600" /> واتساب</a>}
          </div>
        </div>
        <div className="grid gap-px bg-neutral-100 border-t border-neutral-100 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Hash, "الرقم الوظيفي", <span key="n" dir="ltr">{empNo(e.number)}</span>],
            [CalendarDays, "تاريخ الالتحاق", `${formatDate(e.hireDate)}`],
            [Briefcase, "مدة الخدمة", serviceText(e.hireDate, e.terminationDate ?? undefined)],
            [UserRound, "المدير المباشر", e.manager ? <Link key="m" href={`/employees/profiles/${e.manager.id}`} className="link">{e.manager.fullName}</Link> : "—"],
          ].map(([Icon, label, value], i) => {
            const I = Icon as typeof Hash;
            return (
              <div key={i} className="bg-white p-4 flex items-center gap-3">
                <I size={18} className="text-brand-700 shrink-0" />
                <div><div className="text-xs text-neutral-500">{label as string}</div><div className="font-medium text-sm">{value as React.ReactNode}</div></div>
              </div>
            );
          })}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="card border-amber-200"><HrAlertsList alerts={alerts} hideName /></div>
      )}

      <Tabs base={base} current={tab} tabs={tabs} />

      {tab === "overview" && (
        <div className="space-y-5">
          <div className="card p-5 space-y-5">
            <InfoGrid items={[
              ["الجنس", e.gender ? GENDER_LABELS[e.gender] : null],
              ["الجنسية", e.nationality],
              ...(canEdit ? [
                ["تاريخ الميلاد", formatDate(e.birthDate)],
                ["الحالة الاجتماعية", e.maritalStatus],
              ] as [string, React.ReactNode][] : []),
            ]} />
            {canEdit && (
              <div className="border-t border-neutral-100 pt-5">
                <h3 className="font-semibold text-sm text-neutral-700 mb-3">الهوية والجواز</h3>
                <InfoGrid items={[
                  ["رقم الهوية / الإقامة", e.nationalId && <span dir="ltr">{e.nationalId}</span>],
                  ["انتهاء الهوية / الإقامة", <Expiry key="i" date={e.idExpiry} />],
                  ["رقم الجواز", e.passportNumber && <span dir="ltr">{e.passportNumber}</span>],
                  ["انتهاء الجواز", <Expiry key="p" date={e.passportExpiry} />],
                ]} />
              </div>
            )}
            <div className="border-t border-neutral-100 pt-5">
              <h3 className="font-semibold text-sm text-neutral-700 mb-3">التواصل</h3>
              <InfoGrid items={[
                ["الجوال", e.phone && <span className="flex items-center gap-1"><Phone size={13} /><span dir="ltr">{e.phone}</span></span>],
                ["البريد الشخصي", e.personalEmail && <span className="flex items-center gap-1"><Mail size={13} />{e.personalEmail}</span>],
                ["المدينة", e.city],
                ...(canEdit ? [
                  ["العنوان", e.address],
                  ["جهة اتصال الطوارئ", e.emergencyName && `${e.emergencyName}${e.emergencyRelation ? ` (${e.emergencyRelation})` : ""}`],
                  ["جوال الطوارئ", e.emergencyPhone && <span dir="ltr">{e.emergencyPhone}</span>],
                ] as [string, React.ReactNode][] : []),
              ]} />
            </div>
          </div>
          {canEdit && (
            <Collapsible label="تعديل البيانات الشخصية">
              <ActionForm action={updateEmployee} submitLabel="حفظ التعديلات" resetOnSuccess={false}>
                <EditHidden />
                <PersonalFields e={e} />
                <div className="border-t border-neutral-100 pt-4"><IdentityFields e={e} /></div>
                <div className="border-t border-neutral-100 pt-4"><ContactFields e={e} /></div>
              </ActionForm>
            </Collapsible>
          )}
        </div>
      )}

      {tab === "job" && <JobTab />}
      {tab === "leave" && canEdit && <LeaveTab />}
      {tab === "performance" && canEdit && <PerformanceTab />}
      {tab === "salary" && canManage && <SalaryTab />}
      {tab === "documents" && canManage && <DocumentsTab />}
      {tab === "access" && user.isAdmin && <AccessTab />}
    </div>
  );

  // حقول مخفية: باقي بيانات الموظف عشان فورم التعديل الجزئي يحفظها زي ما هي
  function EditHidden({ except = "" }: { except?: string }) {
    const keep: Record<string, string> = {
      id: e!.id, fullName: e!.fullName, fullNameEn: e!.fullNameEn ?? "", gender: e!.gender ?? "", birthDate: dateInputValue(e!.birthDate),
      maritalStatus: e!.maritalStatus ?? "", nationality: e!.nationality ?? "", nationalId: e!.nationalId ?? "", idExpiry: dateInputValue(e!.idExpiry),
      passportNumber: e!.passportNumber ?? "", passportExpiry: dateInputValue(e!.passportExpiry), phone: e!.phone ?? "", personalEmail: e!.personalEmail ?? "",
      city: e!.city ?? "", address: e!.address ?? "", emergencyName: e!.emergencyName ?? "", emergencyRelation: e!.emergencyRelation ?? "",
      emergencyPhone: e!.emergencyPhone ?? "", jobTitle: e!.jobTitle, orgDepartment: e!.orgDepartment ?? "", managerId: e!.managerId ?? "",
      employmentType: e!.employmentType, hireDate: dateInputValue(e!.hireDate), probationEnd: dateInputValue(e!.probationEnd),
      contractEnd: dateInputValue(e!.contractEnd), workLocation: e!.workLocation ?? "", notes: e!.notes ?? "",
    };
    const personal = ["fullName", "fullNameEn", "gender", "birthDate", "maritalStatus", "nationality", "nationalId", "idExpiry", "passportNumber",
      "passportExpiry", "phone", "personalEmail", "city", "address", "emergencyName", "emergencyRelation", "emergencyPhone"];
    const job = ["jobTitle", "orgDepartment", "managerId", "employmentType", "hireDate", "probationEnd", "contractEnd", "workLocation", "notes"];
    const skip = new Set(except === "job" ? job : personal);
    return <>{Object.entries(keep).filter(([k]) => k === "id" || !skip.has(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>;
  }

  async function JobTab() {
    const [managers, leaders] = await Promise.all([
      db.employee.findMany({ where: { status: { not: "TERMINATED" }, id: { not: id } }, select: { id: true, fullName: true, jobTitle: true }, orderBy: { fullName: "asc" } }),
      loadLeaders(),
    ]);
    return (
      <div className="space-y-5">
        <div className="card p-5">
          <InfoGrid items={[
            ["المسمى الوظيفي", e!.jobTitle],
            ["الإدارة", e!.orgDepartment],
            ["نوع التعاقد", EMPLOYMENT_TYPE_LABELS[e!.employmentType]],
            ["تاريخ الالتحاق", formatDate(e!.hireDate)],
            ["نهاية فترة التجربة", <Expiry key="p" date={e!.probationEnd} />],
            ["انتهاء العقد", <Expiry key="c" date={e!.contractEnd} />],
            ["مقر العمل", e!.workLocation],
            ...(e!.status === "TERMINATED" ? [
              ["تاريخ انتهاء الخدمة", formatDate(e!.terminationDate)],
              ["سبب انتهاء الخدمة", e!.terminationReason ? TERMINATION_REASONS[e!.terminationReason as TerminationReason] : null],
            ] as [string, React.ReactNode][] : []),
          ]} />
          {e!.notes && <p className="mt-4 text-sm text-neutral-600 whitespace-pre-line border-t border-neutral-100 pt-4">{e!.notes}</p>}
        </div>

        {e!.reports.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold mb-3">المرؤوسون المباشرون ({e!.reports.length})</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {e!.reports.map((r) => (
                <Link key={r.id} href={`/employees/profiles/${r.id}`} className="flex items-center gap-3 rounded-lg border border-neutral-100 p-2.5 hover:bg-neutral-50">
                  <EmployeeAvatar name={r.fullName} size="sm" />
                  <div className="min-w-0"><div className="text-sm font-medium truncate">{r.fullName}</div><div className="text-xs text-neutral-500 truncate">{r.jobTitle}</div></div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {canEdit && e!.status !== "TERMINATED" && (
          <div className="card p-5 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">تغيير الحالة:</span>
            {(["ACTIVE", "ON_LEAVE", "SUSPENDED"] as const).filter((s) => s !== e!.status).map((s) => (
              <form key={s} action={setEmployeeStatus}>
                <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={s} />
                <button className="btn-secondary !py-1.5">{EMPLOYEE_STATUS_LABELS[s]}</button>
              </form>
            ))}
          </div>
        )}

        {canEdit && (
          <Collapsible label="تعديل البيانات الوظيفية">
            <ActionForm action={updateEmployee} submitLabel="حفظ التعديلات" resetOnSuccess={false}>
              <EditHidden except="job" />
              <JobFields e={e!} managers={managers} leaders={leaders} />
            </ActionForm>
          </Collapsible>
        )}

        {canManage && (e!.status === "TERMINATED" ? (
          <div className="card p-5 flex items-center justify-between gap-3">
            <span className="text-sm text-neutral-600">انتهت خدمة هذا الموظف. يمكن إعادته إلى العمل إذا سُجّل الإنهاء بالخطأ.</span>
            <form action={reinstateEmployee}><input type="hidden" name="id" value={id} /><button className="btn-secondary">إعادة إلى العمل</button></form>
          </div>
        ) : (
          <Collapsible label="تسجيل انتهاء الخدمة">
            <ActionForm action={terminateEmployee} submitLabel="تأكيد انتهاء الخدمة" resetOnSuccess={false}>
              <input type="hidden" name="id" value={id} />
              <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">سيُوقف حساب دخول الموظف تلقائياً، ويبقى ملفه محفوظاً في السجل.</p>
              <FieldGrid>
                <Field label="تاريخ انتهاء الخدمة *"><DateField name="terminationDate" defaultValue={dateInputValue(new Date())} required /></Field>
                <Field label="السبب *">
                  <select name="terminationReason" required defaultValue="" className="input">
                    <option value="" disabled>اختر السبب</option>
                    {Object.entries(TERMINATION_REASONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
              </FieldGrid>
            </ActionForm>
          </Collapsible>
        ))}
      </div>
    );
  }

  function SalaryTab() {
    const wage = totalWage(e!);
    const end = e!.terminationDate ?? new Date();
    const { totalYears } = serviceParts(e!.hireDate, end);
    const reason = (e!.terminationReason as TerminationReason | null) ?? null;
    const eosbFull = endOfServiceBenefit(wage, totalYears, "TERMINATION");
    const eosbResign = endOfServiceBenefit(wage, totalYears, "RESIGNATION");
    const rows: [string, unknown][] = [
      ["الراتب الأساسي", e!.basicSalary], ["بدل السكن", e!.housingAllowance], ["بدل النقل", e!.transportAllowance], ["بدلات أخرى", e!.otherAllowances],
    ];
    return (
      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="font-semibold mb-3">مكونات الراتب الشهري</h3>
            <table className="w-full text-sm">
              <tbody>
                {rows.map(([l, v]) => (
                  <tr key={l} className="border-b border-neutral-100"><td className="py-2 text-neutral-600">{l}</td><td className="py-2 text-left">{formatSAR(v as never)}</td></tr>
                ))}
                <tr><td className="pt-3 font-semibold">الإجمالي</td><td className="pt-3 text-left font-bold text-brand-800 text-lg">{formatSAR(wage)}</td></tr>
              </tbody>
            </table>
            <div className="mt-4 border-t border-neutral-100 pt-4 text-sm space-y-1">
              <div><span className="text-neutral-500">البنك: </span>{e!.bankName ?? "—"}</div>
              <div><span className="text-neutral-500">الآيبان: </span><span dir="ltr" className="font-mono">{formatIban(e!.iban) || "—"}</span></div>
              <div><span className="text-neutral-500">التأمينات الاجتماعية: </span>{e!.gosiRegistered ? "مسجّل ✅" : "غير مسجّل"}</div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold">مكافأة نهاية الخدمة <span className="text-xs font-normal text-neutral-500">(تقديرية)</span></h3>
            <p className="text-xs text-neutral-500 mb-4">
              محسوبة على إجمالي الأجر ومدة خدمة {serviceText(e!.hireDate, end)}{e!.terminationDate ? " حتى تاريخ انتهاء الخدمة" : " حتى اليوم"}، وفق المادتين 84 و85 من نظام العمل السعودي.
            </p>
            {wage === 0 ? <p className="text-sm text-neutral-500">يرجى إدخال بيانات الراتب أولاً.</p> : (
              <div className="space-y-3">
                <div className={`rounded-lg p-3 ${reason && reason !== "RESIGNATION" ? "bg-brand-50 ring-1 ring-brand-200" : "bg-neutral-50"}`}>
                  <div className="text-xs text-neutral-600">عند الإنهاء من صاحب العمل أو انتهاء العقد</div>
                  <div className="text-xl font-bold">{formatSAR(eosbFull.payable)}</div>
                </div>
                <div className={`rounded-lg p-3 ${reason === "RESIGNATION" ? "bg-brand-50 ring-1 ring-brand-200" : "bg-neutral-50"}`}>
                  <div className="text-xs text-neutral-600">عند الاستقالة ({eosbResign.factor === 0 ? "لا يستحق قبل سنتين" : eosbResign.factor < 1 ? `${eosbResign.factor < 0.5 ? "ثلث" : "ثلثا"} المكافأة` : "المكافأة كاملة"})</div>
                  <div className="text-xl font-bold">{formatSAR(eosbResign.payable)}</div>
                </div>
                <p className="text-[11px] text-neutral-500">نصف أجر شهر عن كل سنة من السنوات الخمس الأولى، وأجر شهر كامل عن كل سنة بعدها. الأرقام استرشادية ويُرجع إلى المختص عند التسوية النهائية.</p>
              </div>
            )}
          </div>
        </div>
        <Collapsible label="تعديل بيانات الراتب">
          <ActionForm action={updateSalary} submitLabel="حفظ" resetOnSuccess={false}>
            <input type="hidden" name="id" value={id} />
            <SalaryFields e={e!} />
          </ActionForm>
        </Collapsible>
      </div>
    );
  }

  async function LeaveTab() {
    const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonthKey();
    const requests = await db.leaveRequest.findMany({ where: { employeeId: id }, include: REQUEST_INCLUDE, orderBy: { createdAt: "desc" }, take: 30 });
    return (
      <div className="space-y-5">
        <LeaveBalanceCard employee={e!} />
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3 className="font-semibold">سجل الحضور</h3>
            <form className="flex gap-2"><input type="hidden" name="tab" value="leave" />
              <MonthField name="month" defaultValue={month} /><button className="btn-secondary !py-1.5">عرض</button></form>
          </div>
          <MonthAttendance employee={e!} month={month} />
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold">طلبات الإجازة والاستئذان</h3>
          <RequestsTable rows={requests} user={user} showEmployee={false} />
        </div>
      </div>
    );
  }

  async function PerformanceTab() {
    const reviews = await db.performanceReview.findMany({ where: { employeeId: id }, orderBy: { periodStart: "desc" } });
    return (
      <div className="space-y-3">
        <Link href={`/employees/performance/review?employee=${id}&period=${currentPeriod()}`} className="btn-primary w-fit">تقييم {periodLabel(currentPeriod())}</Link>
        <div className="card divide-y divide-neutral-100">
          {reviews.map((r) => {
            const rt = rating(r.overall);
            return (
              <Link key={r.id} href={`/employees/performance/review?employee=${id}&period=${r.period}`} className="flex items-center gap-3 p-3 hover:bg-neutral-50">
                <span className="flex-1 font-medium">{periodLabel(r.period)}</span>
                <span className="text-xs text-neutral-500">{REVIEW_STATUS_LABELS[r.status]}</span>
                {r.status !== "DRAFT" && <><b>{r.overall.toFixed(2)}</b><span className={`rounded-full px-2.5 py-0.5 text-xs ${rt.cls}`}>{rt.label}</span></>}
              </Link>
            );
          })}
          {reviews.length === 0 && <p className="p-4 text-sm text-neutral-500">لا توجد تقييمات سابقة</p>}
        </div>
      </div>
    );
  }

  async function DocumentsTab() {
    const documents = await db.document.findMany({ where: { employeeId: id }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } });
    return <DocumentsSection ownerType="employee" ownerId={id} documents={documents} userId={user.id} canUpload={canManage} canManage={canManage} />;
  }

  function AccessTab() {
    if (!e!.user) {
      return (
        <div className="card p-5 space-y-4">
          <p className="text-sm text-neutral-600">لا يملك هذا الموظف حساب دخول على المنصة.</p>
          <ActionForm action={grantLogin} submitLabel="إنشاء حساب الدخول">
            <input type="hidden" name="id" value={id} />
            <LoginFields sections={PERMISSION_SECTIONS} toggle={false} />
          </ActionForm>
        </div>
      );
    }
    const u = e!.user;
    return (
      <div className="space-y-5">
        <div className="card p-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="space-y-1">
            <div><span className="text-neutral-500">البريد الإلكتروني للدخول: </span><span dir="ltr">{u.email}</span></div>
            <div><span className="text-neutral-500">الحالة: </span>{u.active ? "نشط" : "موقوف"}{u.mustChangePassword && " · بانتظار تغيير كلمة المرور المؤقتة"}</div>
            <AccessSummary isAdmin={u.role === "ADMIN"} perms={u.permissions} />
          </div>
          <Link href={`/settings/users/${u.id}`} className="btn-secondary">إدارة الحساب وكلمة المرور</Link>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">الصلاحيات</h3>
          <ActionForm action={updateAccess} submitLabel="حفظ الصلاحيات" resetOnSuccess={false}>
            <input type="hidden" name="id" value={u.id} />
            <PermissionMatrix sections={PERMISSION_SECTIONS} canGrantAdmin initialAdmin={u.role === "ADMIN"}
              initial={Object.fromEntries(u.permissions.map((p) => [p.section, p.level]))} />
          </ActionForm>
        </div>
      </div>
    );
  }
}
