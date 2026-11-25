import { Download } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { requireSection } from "@/lib/auth";
import { IMPORT_COLUMNS } from "@/lib/import-columns";
import ImportForm from "./ImportForm";

export default async function ImportPage() {
  await requireSection("clients");
  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="استيراد العملاء من Excel" crumbs={[{ label: "العملاء", href: "/clients/directory" }, { label: "استيراد" }]} />
      <div className="card p-5 space-y-3 text-sm">
        <h2 className="font-semibold">طريقة الاستيراد</h2>
        <ol className="list-decimal pr-5 space-y-1.5 text-neutral-700">
          <li>نزّل القالب الجاهز واملأه (يمثل كل صف عميلاً وشركة واحدة).</li>
          <li>إذا كان للعميل أكثر من شركة: كرّر اسمه ورقم هويته في صف مستقل لكل شركة.</li>
          <li>ارفع الملف واضغط <b>&quot;افحص الملف&quot;</b> — لن يتم حفظ أي بيانات في هذه الخطوة.</li>
          <li>إذا لم تظهر أخطاء اضغط <b>&quot;استيراد&quot;</b>.</li>
        </ol>
        <p className="text-neutral-500">
          الأعمدة: {IMPORT_COLUMNS.map((c) => c.header + ("required" in c ? " *" : "")).join(" · ")}
        </p>
        {/* تحميل ملف: لازم رابط عادي مش تنقّل بين الصفحات */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/export/template" className="btn-primary w-fit"><Download size={16} /> تنزيل القالب</a>
      </div>
      <ImportForm />
    </div>
  );
}
