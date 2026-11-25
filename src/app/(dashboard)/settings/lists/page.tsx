import ActionForm from "@/components/ui/ActionForm";
import PageHeader from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveListItem } from "./actions";

type Item = { id: string; name: string; order: number; active: boolean; kind?: string };
type ListKey = "serviceType" | "govEntity" | "stage";

const KINDS = { OPEN: "جارية", DONE: "مكتملة", CANCELLED: "ملغاة" };

function ItemFields({ list, item, nextOrder }: { list: ListKey; item?: Item; nextOrder?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="list" value={list} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <input name="order" type="number" min={0} defaultValue={item?.order ?? nextOrder} title="الترتيب" className="input w-20" />
      <input name="name" required defaultValue={item?.name} placeholder="الاسم" className="input flex-1 min-w-48" />
      {list === "stage" && (
        <select name="kind" defaultValue={item?.kind ?? "OPEN"} className="input w-auto" title="نوع المرحلة">
          {Object.entries(KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
      {item && (
        <select name="active" defaultValue={item.active ? "on" : "off"} className="input w-auto">
          <option value="on">مفعّل</option>
          <option value="off">موقوف</option>
        </select>
      )}
    </div>
  );
}

function ListCard({ title, hint, list, items }: { title: string; hint: string; list: ListKey; items: Item[] }) {
  const nextOrder = Math.max(-1, ...items.map((i) => i.order)) + 1;
  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-slate-500">{hint}</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <ActionForm key={item.id} action={saveListItem} submitLabel="حفظ" resetOnSuccess={false}
            className={`flex flex-wrap items-center gap-2 ${item.active ? "" : "opacity-50"}`}>
            <ItemFields list={list} item={item} />
          </ActionForm>
        ))}
      </div>
      <div className="border-t border-slate-100 pt-4">
        <p className="text-sm font-medium mb-2">إضافة جديد</p>
        <ActionForm action={saveListItem} submitLabel="إضافة" className="flex flex-wrap items-center gap-2">
          <ItemFields list={list} nextOrder={nextOrder} />
        </ActionForm>
      </div>
    </section>
  );
}

export default async function ListsPage() {
  await requireAdmin();
  const [services, entities, stages] = await Promise.all([
    db.serviceType.findMany({ orderBy: { order: "asc" } }),
    db.govEntity.findMany({ orderBy: { order: "asc" } }),
    db.stage.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="القوائم والمراحل" crumbs={[{ label: "الإعدادات" }, { label: "القوائم والمراحل" }]} />
      <p className="text-sm text-slate-600">
        الرقم الصغير على اليمين هو <b>الترتيب</b>. لو عاوز توقف عنصر من غير ما تمسحه اختار &quot;موقوف&quot;، وساعتها مش هيظهر في المعاملات الجديدة.
      </p>
      <ListCard title="مراحل المعاملة" list="stage" items={stages}
        hint="المعاملة الجديدة بتبدأ من أول مرحلة جارية. المراحل المكتملة والملغاة مش بتظهر في لوحة المتابعة." />
      <ListCard title="أنواع الخدمات" list="serviceType" items={services} hint="الخدمات اللي بتقدمها الشركة" />
      <ListCard title="الجهات والمنصات الحكومية" list="govEntity" items={entities} hint="الجهات اللي بتتعامل معاها المعاملات" />
    </div>
  );
}
