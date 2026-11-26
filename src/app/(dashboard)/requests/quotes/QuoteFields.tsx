"use client";

// حقول عرض السعر: العميل، الصلاحية، البنود بحساب مباشر للإجمالي والضريبة
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import ClientCompanyPicker from "@/components/ClientCompanyPicker";
import DateField from "@/components/ui/DateField";
import { Field, FieldGrid } from "@/components/ui/Field";
import { PAYMENT_TERMS, lineTotal, quoteTotals } from "@/lib/quotes";

type Client = { id: string; name: string; companies: { id: string; name: string }[] };
type Service = { id: string; name: string; group: string };
export type QuoteDraft = {
  id?: string; clientId?: string | null; companyId?: string | null; title?: string; validUntil: string;
  paymentTerms?: string | null; notes?: string | null; govFees?: string | null;
  items: { description: string; quantity: string; unitPrice: string; serviceTypeId: string | null }[];
};

const money = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: string) => (/^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : 0);
const emptyRow = () => ({ key: Math.random(), description: "", quantity: "1", unitPrice: "", serviceTypeId: "" });

export default function QuoteFields({ clients, services, draft }: { clients: Client[]; services: Service[]; draft: QuoteDraft }) {
  const [rows, setRows] = useState(() =>
    draft.items.length
      ? draft.items.map((i) => ({ key: Math.random(), ...i, serviceTypeId: i.serviceTypeId ?? "" }))
      : [emptyRow()],
  );
  const set = (key: number, patch: Partial<ReturnType<typeof emptyRow>>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  // اختيار خدمة من الكتالوج يملأ الوصف إن كان فارغاً
  const pickService = (key: number, id: string) => {
    const s = services.find((x) => x.id === id);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, serviceTypeId: id, description: r.description || (s?.name ?? "") } : r)));
  };
  const lines = rows.map((r) => ({ quantity: num(r.quantity), unitPrice: num(r.unitPrice) }));
  const totals = quoteTotals(lines);
  const groups = Object.entries(Object.groupBy(services, (s) => s.group));

  return (
    <div className="space-y-6">
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      <FieldGrid>
        <ClientCompanyPicker clients={clients} clientId={draft.clientId} companyId={draft.companyId} />
        <Field label="عنوان العرض *">
          <input name="title" required defaultValue={draft.title} placeholder="مثال: تأسيس شركة واستخراج التراخيص" className="input" />
        </Field>
        <Field label="صالح حتى *">
          <DateField name="validUntil" defaultValue={draft.validUntil} required />
        </Field>
        <Field label="طريقة الدفع">
          <input name="paymentTerms" list="payment-terms" defaultValue={draft.paymentTerms ?? ""} placeholder="اختر أو اكتب" className="input" />
          <datalist id="payment-terms">{PAYMENT_TERMS.map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
        <Field label="الرسوم الحكومية المتوقعة (خارج العرض، بالريال)">
          <input name="govFees" inputMode="decimal" dir="ltr" defaultValue={draft.govFees ?? ""} className="input" />
        </Field>
      </FieldGrid>

      <div className="space-y-3">
        <h3 className="font-bold">البنود</h3>
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="table min-w-[760px]">
            <thead>
              <tr><th className="w-8">#</th><th>الخدمة من الكتالوج</th><th>الوصف *</th><th className="w-24">الكمية</th><th className="w-36">سعر الوحدة</th><th className="w-32">الإجمالي</th><th className="w-10"><span className="sr-only">حذف</span></th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <td className="text-neutral-500">{i + 1}</td>
                  <td>
                    <select name="item_service" value={r.serviceTypeId} onChange={(e) => pickService(r.key, e.target.value)} className="input max-w-52" aria-label={`خدمة البند ${i + 1}`}>
                      <option value="">— بدون —</option>
                      {groups.map(([g, list]) => (
                        <optgroup key={g} label={g}>{list!.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
                      ))}
                    </select>
                  </td>
                  <td><input name="item_desc" value={r.description} onChange={(e) => set(r.key, { description: e.target.value })} className="input min-w-56" aria-label={`وصف البند ${i + 1}`} /></td>
                  <td><input name="item_qty" value={r.quantity} onChange={(e) => set(r.key, { quantity: e.target.value })} inputMode="decimal" dir="ltr" className="input" aria-label={`كمية البند ${i + 1}`} /></td>
                  <td><input name="item_price" value={r.unitPrice} onChange={(e) => set(r.key, { unitPrice: e.target.value })} inputMode="decimal" dir="ltr" placeholder="0.00" className="input" aria-label={`سعر البند ${i + 1}`} /></td>
                  <td dir="ltr" className="text-right font-semibold tabular-nums">{money(lineTotal(lines[i]))}</td>
                  <td>
                    <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))}
                      disabled={rows.length === 1} aria-label={`حذف البند ${i + 1}`} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-30">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow()])} className="btn-secondary"><Plus size={16} /> إضافة بند</button>

        <dl className="mr-auto w-full max-w-sm space-y-1.5 rounded-xl bg-neutral-50 p-4 text-sm">
          <div className="flex justify-between"><dt>الإجمالي قبل الضريبة</dt><dd dir="ltr" className="tabular-nums">{money(totals.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>ضريبة القيمة المضافة 15%</dt><dd dir="ltr" className="tabular-nums">{money(totals.vatAmount)}</dd></div>
          <div className="flex justify-between border-t border-neutral-200 pt-1.5 text-base font-bold"><dt>الإجمالي شامل الضريبة</dt><dd dir="ltr" className="tabular-nums">{money(totals.total)} ر.س</dd></div>
        </dl>
      </div>

      <Field label="ملاحظات وشروط تظهر للعميل" wide>
        <textarea name="notes" rows={3} defaultValue={draft.notes ?? ""} className="input" />
      </Field>
    </div>
  );
}
