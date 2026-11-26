"use client";

// بنود طلب الشراء: إضافة وحذف صفوف، وتعليم البند كأصل يُضاف لسجل الأصول عند الاستلام
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Row = { key: number; asset: boolean };
const fmt = new Intl.NumberFormat("ar-SA-u-nu-latn", { style: "currency", currency: "SAR", maximumFractionDigits: 2 });

export default function PurchaseItemsFields({ categories, max }: { categories: { id: string; name: string }[]; max: number }) {
  const [rows, setRows] = useState<Row[]>([{ key: 1, asset: false }]);
  const [totals, setTotals] = useState<Record<number, number>>({});
  const next = () => Math.max(0, ...rows.map((r) => r.key)) + 1;
  const total = rows.reduce((s, r) => s + (totals[r.key] ?? 0), 0);

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-medium">البنود المطلوبة *</legend>
      {rows.map((r, i) => (
        <div
          key={r.key}
          className="grid gap-2 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[1fr_6rem_9rem_auto]"
          onInput={(e) => {
            const box = e.currentTarget;
            const q = Number((box.querySelector("[name=itemQty]") as HTMLInputElement).value) || 0;
            const p = Number((box.querySelector("[name=itemPrice]") as HTMLInputElement).value) || 0;
            setTotals((t) => ({ ...t, [r.key]: q * p }));
          }}
        >
          <input name="itemDesc" required={i === 0} placeholder="الصنف، مثل: حاسب محمول بمعالج Core i7…" aria-label={`وصف البند ${i + 1}`} autoComplete="off" className="input" />
          <input name="itemQty" type="number" min={1} max={1000} defaultValue={1} aria-label={`الكمية للبند ${i + 1}`} className="input tabular-nums" />
          <input name="itemPrice" inputMode="decimal" dir="ltr" placeholder="سعر الوحدة…" aria-label={`السعر التقديري للوحدة للبند ${i + 1}`} autoComplete="off" className="input tabular-nums" />
          <button
            type="button"
            onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
            disabled={rows.length === 1}
            aria-label={`حذف البند ${i + 1}`}
            className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-30"
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox" name="itemAsset" value={i} checked={r.asset}
                onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, asset: e.target.checked } : x)))}
                className="size-4 accent-brand-600"
              />
              أصل (جهاز، أثاث، سيارة…) يُضاف لسجل الأصول عند الاستلام
            </label>
            {r.asset ? (
              <select name="itemCategory" required defaultValue="" aria-label={`تصنيف الأصل للبند ${i + 1}`} className="input w-auto">
                <option value="" disabled>تصنيف الأصل</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : <input type="hidden" name="itemCategory" value="" />}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setRows([...rows, { key: next(), asset: false }])} disabled={rows.length >= max} className="btn-secondary">
          <Plus size={16} aria-hidden="true" /> إضافة بند
        </button>
        <p className="text-sm">الإجمالي التقديري: <b className="tabular-nums">{fmt.format(total)}</b></p>
      </div>
    </fieldset>
  );
}
