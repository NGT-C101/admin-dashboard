import ActionForm from "@/components/ui/ActionForm";
import PageHeader from "@/components/ui/PageHeader";
import { SECTION } from "@/lib/assets";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveAsset } from "../actions";
import AssetFields from "../fields";

export default async function NewAssetPage() {
  await requireSection(SECTION, "EDIT");
  const categories = await db.assetCategory.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return (
    <div className="space-y-6">
      <PageHeader title="أصل جديد" crumbs={[{ label: "الأصول والعُهد", href: "/admin-affairs/assets" }, { label: "أصل جديد" }]} />
      <div className="card p-5">
        <ActionForm action={saveAsset} submitLabel="حفظ الأصل">
          <AssetFields categories={categories} />
          <p className="text-sm text-neutral-500">يحصل الأصل على رقم تلقائي (AST-0001). بعد الحفظ يمكنك رفع الفاتورة أو شهادة الضمان وتسليمه لموظف كعهدة.</p>
        </ActionForm>
      </div>
    </div>
  );
}
