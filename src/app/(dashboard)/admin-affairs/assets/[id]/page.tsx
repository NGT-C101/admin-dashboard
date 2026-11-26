import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import DocumentsSection from "@/components/DocumentsSection";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import { Field } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import {
  ASSET_STATUS_LABELS, ASSET_STATUS_STYLES, CUSTODY_STATUS_LABELS, CUSTODY_STATUS_STYLES, SECTION, assetNumber,
} from "@/lib/assets";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatSAR } from "@/lib/format";
import { acknowledgeCustody, assignCustody, returnCustody, saveAsset, setAssetStatus } from "../actions";
import AssetFields from "../fields";

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSection(SECTION);
  const { id } = await params;
  const a = await db.asset.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      createdBy: { select: { name: true } },
      documents: { orderBy: { createdAt: "asc" }, include: { uploadedBy: { select: { name: true } } } },
      custodies: {
        orderBy: { assignedAt: "desc" },
        include: { employee: { select: { id: true, fullName: true } }, assignedBy: { select: { name: true } }, receivedBy: { select: { name: true } } },
      },
    },
  });
  if (!a) notFound();
  const edit = can(user, SECTION, "EDIT");
  const manage = can(user, SECTION, "MANAGE");
  const open = a.custodies.find((c) => c.status !== "RETURNED");
  const [categories, employees] = await Promise.all([
    edit ? db.assetCategory.findMany({ where: { OR: [{ active: true }, { id: a.categoryId }] }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } }) : [],
    edit && a.status === "AVAILABLE" ? db.employee.findMany({ where: { status: { not: "TERMINATED" } }, select: { id: true, fullName: true, jobTitle: true }, orderBy: { fullName: "asc" } }) : [],
  ]);

  const info: [string, React.ReactNode][] = [
    ["التصنيف", a.category.name],
    ["الماركة / الموديل", a.brand],
    ["الرقم التسلسلي", a.serialNumber && <span key="s" dir="ltr">{a.serialNumber}</span>],
    ["الموقع", a.location],
    ["تاريخ الشراء", formatDate(a.purchaseDate)],
    ["سعر الشراء", <span key="p" className="tabular-nums">{formatSAR(a.purchasePrice)}</span>],
    ["المورد", a.supplier],
    ["انتهاء الضمان", formatDate(a.warrantyEnd)],
    ["لدى", open ? <Link key="h" href={`/employees/profiles/${open.employee.id}`} className="link">{open.employee.fullName}</Link> : "—"],
    ["أضافه", `${a.createdBy.name} — ${formatDate(a.createdAt)}`],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={a.name}
        crumbs={[{ label: "الأصول والعُهد", href: "/admin-affairs/assets" }, { label: assetNumber(a.number) }]}
        actions={<Badge className={ASSET_STATUS_STYLES[a.status]}>{ASSET_STATUS_LABELS[a.status]}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {info.map(([label, value]) => (
                <div key={label}><dt className="text-xs text-neutral-500">{label}</dt><dd className="break-words font-medium" dir="auto">{value || "—"}</dd></div>
              ))}
            </dl>
            {a.notes && <p className="mt-4 whitespace-pre-line border-t border-neutral-100 pt-4 text-sm text-neutral-600">{a.notes}</p>}
          </div>

          {edit && (
            <Collapsible label="تعديل بيانات الأصل">
              <ActionForm action={saveAsset} submitLabel="حفظ التعديلات" resetOnSuccess={false}>
                <AssetFields asset={a} categories={categories} />
              </ActionForm>
            </Collapsible>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">سجل العُهد <span className="text-sm font-normal text-neutral-500">({a.custodies.length})</span></h2>
            <div className="card overflow-x-auto">
              <table className="table min-w-[720px]">
                <thead><tr><th>الموظف</th><th>التسليم</th><th>الإقرار</th><th>الإعادة</th><th>الحالة</th><th></th></tr></thead>
                <tbody>
                  {a.custodies.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-neutral-500">لم يُسلَّم هذا الأصل لأي موظف بعد</td></tr>}
                  {a.custodies.map((c) => (
                    <tr key={c.id}>
                      <td><Link href={`/employees/profiles/${c.employee.id}`} className="link">{c.employee.fullName}</Link></td>
                      <td className="text-sm">{formatDate(c.assignedAt)}<div className="text-xs text-neutral-500">{c.assignedBy.name}{c.conditionOut && ` · ${c.conditionOut}`}</div></td>
                      <td className="text-sm">{c.acknowledgedAt ? <>{formatDateTime(c.acknowledgedAt)}<div className="text-xs text-neutral-500">{c.ackMethod === "PAPER" ? "نموذج موقّع ورقياً" : "أقرّ عبر المنصة"}</div></> : "—"}</td>
                      <td className="text-sm">{c.returnedAt ? <>{formatDate(c.returnedAt)}<div className="text-xs text-neutral-500">{[c.receivedBy?.name, c.conditionIn].filter(Boolean).join(" · ")}</div></> : "—"}</td>
                      <td><Badge className={CUSTODY_STATUS_STYLES[c.status]}>{CUSTODY_STATUS_LABELS[c.status]}</Badge></td>
                      <td><Link href={`/admin-affairs/assets/custody/${c.id}`} className="link flex items-center gap-1 whitespace-nowrap text-xs"><Printer size={14} aria-hidden="true" /> نموذج الاستلام</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <DocumentsSection ownerType="asset" ownerId={a.id} title="مرفقات الأصل (الفاتورة، الضمان، الصور)" documents={a.documents} userId={user.id} canUpload={edit} canManage={manage} />
        </div>

        <div className="space-y-6">
          {edit && a.status === "AVAILABLE" && (
            <div className="card p-5">
              <h2 className="mb-3 font-semibold">تسليم كعهدة لموظف</h2>
              <ActionForm action={assignCustody} submitLabel="تسليم العهدة">
                <input type="hidden" name="assetId" value={a.id} />
                <Field label="الموظف *">
                  <select name="employeeId" required defaultValue="" className="input">
                    <option value="" disabled>اختر الموظف</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName} — {e.jobTitle}</option>)}
                  </select>
                </Field>
                <Field label="حالة الأصل عند التسليم"><input name="conditionOut" placeholder="مثال: جديد، بحالة ممتازة مع الشاحن…" className="input" /></Field>
                <Field label="ملاحظة"><input name="note" className="input" /></Field>
                <p className="text-xs text-neutral-500">يصل للموظف طلب إقرار بالاستلام في «خدماتي». ويمكن طباعة نموذج الاستلام للتوقيع.</p>
              </ActionForm>
            </div>
          )}

          {open && (
            <div className="card space-y-4 p-5">
              <h2 className="font-semibold">العهدة الحالية: {open.employee.fullName}</h2>
              <Badge className={CUSTODY_STATUS_STYLES[open.status]}>{CUSTODY_STATUS_LABELS[open.status]}</Badge>
              {open.status === "PENDING" && manage && (
                <ActionForm action={acknowledgeCustody} submitLabel="تسجيل نموذج موقّع ورقياً" confirm="هل وقّع الموظف نموذج استلام العهدة الورقي؟">
                  <input type="hidden" name="id" value={open.id} />
                  <input type="hidden" name="method" value="PAPER" />
                  <p className="text-xs text-neutral-500">للموظف الذي ليس له حساب دخول: اطبع النموذج، وبعد توقيعه سجّله هنا وارفع صورته في المرفقات.</p>
                </ActionForm>
              )}
              {edit && (
                <ActionForm action={returnCustody} submitLabel="تسجيل الإعادة" confirm={`تأكيد استلام الأصل من ${open.employee.fullName}؟`}>
                  <input type="hidden" name="id" value={open.id} />
                  <Field label="حالة الأصل عند الإعادة"><input name="conditionIn" placeholder="مثال: سليم، به خدش في الغطاء…" className="input" /></Field>
                  <Field label="حالة الأصل بعد الإعادة">
                    <select name="assetStatus" defaultValue="AVAILABLE" className="input">
                      <option value="AVAILABLE">متاح لتسليمه مجدداً</option>
                      <option value="MAINTENANCE">يحتاج صيانة</option>
                      <option value="RETIRED">تالف — يُستبعد</option>
                      <option value="LOST">مفقود</option>
                    </select>
                  </Field>
                  <Field label="ملاحظات (مطلوبة لغير «متاح»)"><textarea name="returnNote" rows={2} className="input" /></Field>
                </ActionForm>
              )}
            </div>
          )}

          {manage && !open && (
            <div className="card p-5">
              <h2 className="mb-3 font-semibold">تغيير حالة الأصل</h2>
              <ActionForm action={setAssetStatus} submitLabel="حفظ الحالة" resetOnSuccess={false} confirm="تأكيد تغيير حالة الأصل؟">
                <input type="hidden" name="id" value={a.id} />
                <select name="status" defaultValue={a.status} aria-label="الحالة" className="input">
                  <option value="AVAILABLE">متاح</option>
                  <option value="MAINTENANCE">في الصيانة</option>
                  <option value="RETIRED">مستبعد (تالف أو مباع)</option>
                  <option value="LOST">مفقود</option>
                </select>
                <input name="note" placeholder="سبب التغيير (يُضاف إلى الملاحظات)…" aria-label="سبب التغيير" className="input" />
              </ActionForm>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
