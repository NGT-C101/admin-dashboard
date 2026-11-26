import PurchaseItemsFields from "@/components/PurchaseItemsFields";
import ActionForm from "@/components/ui/ActionForm";
import DateField from "@/components/ui/DateField";
import { Field, FieldGrid } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_ITEMS, SECTION, firstStatus } from "@/lib/purchases";
import { createPurchase } from "../actions";

// طلب شراء جديد — متاح لكل موظف
export default async function NewPurchasePage() {
  const user = await requireUser();
  const [categories, first] = await Promise.all([
    db.assetCategory.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    firstStatus(db, user.id),
  ]);
  const back = can(user, SECTION) ? { label: "المشتريات والموردين", href: "/admin-affairs/procurement" } : { label: "خدماتي", href: "/me" };
  return (
    <div className="space-y-6">
      <PageHeader title="طلب شراء جديد" crumbs={[back, { label: "طلب شراء جديد" }]} />
      <div className="card p-5">
        <ActionForm action={createPurchase} submitLabel="تقديم الطلب">
          <FieldGrid>
            <Field label="عنوان الطلب *"><input name="title" required placeholder="مثال: أجهزة حاسب للموظفين الجدد…" autoComplete="off" className="input" /></Field>
            <Field label="مطلوب قبل (اختياري)"><DateField name="neededBy" /></Field>
            <Field label="سبب الحاجة *" wide><textarea name="justification" required rows={3} placeholder="مثال: انضمام موظفَين جديدين لقسم المعاملات الشهر القادم…" className="input" /></Field>
          </FieldGrid>
          <PurchaseItemsFields categories={categories} max={MAX_ITEMS} />
          <p className="text-sm text-neutral-500">
            {first === "PENDING_MANAGER" ? "يُرسل الطلب لمديرك المباشر للموافقة، ثم للشؤون الإدارية للاعتماد والشراء." : "يُرسل الطلب مباشرة للشؤون الإدارية للاعتماد والشراء."}
          </p>
        </ActionForm>
      </div>
    </div>
  );
}
