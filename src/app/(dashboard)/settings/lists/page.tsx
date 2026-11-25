import ActionForm from "@/components/ui/ActionForm";
import PageHeader from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveListItem } from "./actions";

type Item = { id: string; name: string; order: number; active: boolean; kind?: string; govEntityId?: string | null };
type ListKey = "serviceType" | "govEntity" | "stage";
type Entity = { id: string; name: string };

const KINDS = { OPEN: "جارية", DONE: "مكتملة", CANCELLED: "ملغاة" };

function ItemFields({ list, item, nextOrder, entities, entityId }: {
  list: ListKey; item?: Item; nextOrder?: number; entities?: Entity[]; entityId?: string | null;
}) {
  return (
    <>
      <input type="hidden" name="list" value={list} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <input name="order" type="number" min={0} defaultValue={item?.order ?? nextOrder} title="الترتيب" className="input w-20" />
      <input name="name" required defaultValue={item?.name} placeholder="الاسم" className="input flex-1 min-w-48" />
      {list === "stage" && (
        <select name="kind" defaultValue={item?.kind ?? "OPEN"} className="input w-auto" title="نوع المرحلة">
          {Object.entries(KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
      {list === "serviceType" && entities && (
        <select name="govEntityId" defaultValue={item?.govEntityId ?? entityId ?? ""} className="input w-auto max-w-56" title="الجهة">
          <option value="">خدمة عامة</option>
          {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      )}
      {item && (
        <select name="active" defaultValue={item.active ? "on" : "off"} className="input w-auto">
          <option value="on">مفعّل</option>
          <option value="off">موقوف</option>
        </select>
      )}
    </>
  );
}

function ItemRows({ list, items, entities }: { list: ListKey; items: Item[]; entities?: Entity[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ActionForm key={item.id} action={saveListItem} submitLabel="حفظ" resetOnSuccess={false}
          className={`flex flex-wrap items-center gap-2 ${item.active ? "" : "opacity-50"}`}>
          <ItemFields list={list} item={item} entities={entities} />
        </ActionForm>
      ))}
    </div>
  );
}

function AddRow({ list, items, entities, entityId }: { list: ListKey; items: Item[]; entities?: Entity[]; entityId?: string | null }) {
  const nextOrder = Math.max(-1, ...items.map((i) => i.order)) + 1;
  return (
    <ActionForm action={saveListItem} submitLabel="إضافة" className="flex flex-wrap items-center gap-2">
      <ItemFields list={list} nextOrder={nextOrder} entities={entities} entityId={entityId} />
    </ActionForm>
  );
}

function ListCard({ title, hint, list, items }: { title: string; hint: string; list: ListKey; items: Item[] }) {
  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-neutral-500">{hint}</p>
      </div>
      <ItemRows list={list} items={items} />
      <div className="border-t border-neutral-100 pt-4">
        <p className="text-sm font-medium mb-2">إضافة جديد</p>
        <AddRow list={list} items={items} />
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
  const groups: { id: string | null; name: string; items: Item[] }[] = [
    ...entities.map((e) => ({ id: e.id as string | null, name: e.name, items: services.filter((s) => s.govEntityId === e.id) })),
    { id: null, name: "خدمات عامة (غير مرتبطة بجهة)", items: services.filter((s) => !s.govEntityId) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="القوائم والمراحل" crumbs={[{ label: "الإعدادات" }, { label: "القوائم والمراحل" }]} />
      <p className="text-sm text-neutral-600">
        الرقم الصغير على اليمين هو <b>الترتيب</b>. لإيقاف عنصر دون حذفه اختر &quot;موقوف&quot;، ولن يظهر حينها في المعاملات الجديدة.
      </p>

      <ListCard title="مراحل المعاملة" list="stage" items={stages}
        hint="تبدأ المعاملة الجديدة من أول مرحلة جارية، ولا تظهر المراحل المكتملة والملغاة في لوحة المتابعة." />

      <ListCard title="الجهات والمنصات الحكومية" list="govEntity" items={entities}
        hint="الجهات الحكومية التي تُنجز لديها المعاملات" />

      <section className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold">الخدمات حسب الجهة</h2>
          <p className="text-sm text-neutral-500">
            عند اختيار جهة في المعاملة تظهر خدماتها إضافة إلى الخدمات العامة. اضغط على أي جهة لعرض خدماتها،
            ولنقل خدمة إلى جهة أخرى غيّر الجهة المجاورة لها ثم اضغط &quot;حفظ&quot;.
          </p>
        </div>
        {groups.map((g) => (
          <details key={g.id ?? "general"} className="rounded-lg border border-neutral-200">
            <summary className="cursor-pointer select-none p-3 font-medium flex items-center justify-between">
              <span>{g.name}</span>
              <span className="text-xs rounded-full bg-neutral-100 px-2 py-0.5">
                {g.items.filter((i) => i.active).length} خدمة
              </span>
            </summary>
            <div className="border-t border-neutral-100 p-3 space-y-4">
              <ItemRows list="serviceType" items={g.items} entities={entities} />
              <div className={g.items.length ? "border-t border-neutral-100 pt-3" : ""}>
                <p className="text-sm font-medium mb-2">إضافة خدمة {g.id ? `لـ ${g.name}` : "عامة"}</p>
                <AddRow list="serviceType" items={g.items} entities={entities} entityId={g.id} />
              </div>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
