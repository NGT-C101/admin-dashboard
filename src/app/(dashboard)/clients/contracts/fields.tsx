import type { Contract } from "@prisma/client";
import ClientCompanyPicker from "@/components/ClientCompanyPicker";
import { Field, FieldGrid } from "@/components/ui/Field";
import { CONTRACT_TYPE_LABELS } from "@/lib/clients";
import { dateInputValue } from "@/lib/format";
import type { db as DB } from "@/lib/db";

export async function loadContractClients(db: typeof DB) {
  return db.client.findMany({
    select: { id: true, name: true, companies: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export default function ContractFields({ contract, clients, clientId, companyId }: {
  contract?: Contract;
  clients: Awaited<ReturnType<typeof loadContractClients>>;
  clientId?: string;
  companyId?: string;
}) {
  return (
    <FieldGrid>
      {contract && <input type="hidden" name="id" value={contract.id} />}
      <ClientCompanyPicker clients={clients} clientId={contract?.clientId ?? clientId} companyId={contract?.companyId ?? companyId} />
      <Field label="عنوان العقد *">
        <input name="title" required placeholder="مثال: باقة المتابعة الشهرية للمنصات الحكومية" defaultValue={contract?.title} className="input" />
      </Field>
      <Field label="النوع">
        <select name="type" defaultValue={contract?.type ?? "ONE_TIME"} className="input">
          {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="القيمة بالريال (للباقة الشهرية: قيمة الشهر)">
        <input name="value" inputMode="decimal" dir="ltr" defaultValue={contract?.value?.toString() ?? ""} className="input" />
      </Field>
      <Field label="تاريخ البداية *">
        <input name="startDate" type="date" required defaultValue={dateInputValue(contract?.startDate ?? new Date())} className="input" />
      </Field>
      <Field label="تاريخ النهاية (فاضي = مفتوح)">
        <input name="endDate" type="date" defaultValue={dateInputValue(contract?.endDate)} className="input" />
      </Field>
      <label className="flex items-center gap-2 text-sm self-end pb-2">
        <input type="checkbox" name="autoRenew" defaultChecked={contract?.autoRenew} className="size-4 accent-brand-600" />
        تجديد تلقائي
      </label>
      <Field label="الشروط وطريقة الدفع" wide>
        <textarea name="terms" rows={3} placeholder="مثال: 50% مقدّم و50% عند التسليم" defaultValue={contract?.terms ?? ""} className="input" />
      </Field>
    </FieldGrid>
  );
}
