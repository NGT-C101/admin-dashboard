// اختيار درجة من 1 إلى 5 بأزرار متجاورة
import { SCORE_LABELS_CLIENT } from "./scoreLabels";

export default function ScoreInput({ name, label, hint, value }: { name: string; label: string; hint: string; value?: number }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-3 border-b border-neutral-100 py-3">
      <legend className="sr-only">{label}</legend>
      <div className="flex-1 min-w-52"><div className="font-medium text-sm">{label}</div><div className="text-xs text-neutral-500">{hint}</div></div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <label key={v} className="cursor-pointer">
            <input type="radio" name={name} value={v} defaultChecked={value === v} required className="peer sr-only" />
            <span className="flex w-16 flex-col items-center rounded-lg border border-neutral-200 py-1.5 text-xs text-neutral-600 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40 hover:bg-neutral-50">
              <b className="text-base">{v}</b>{SCORE_LABELS_CLIENT[v]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
