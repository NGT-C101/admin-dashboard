"use client";

import { startTransition, useActionState, useRef } from "react";
import { CheckCircle2, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import { importClients } from "./actions";

export default function ImportForm() {
  const [state, action, pending] = useActionState(importClients, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const r = state?.report;

  function submit(mode: "check" | "commit") {
    const fd = new FormData(formRef.current!);
    fd.set("mode", mode);
    startTransition(() => action(fd));
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); submit("check"); }} className="card p-5 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-neutral-600">ملف Excel (xlsx)</span>
          <input name="file" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-brand-800 hover:file:bg-brand-100" />
        </label>
        {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{state.error}</p>}
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} className="btn-secondary"><FileSpreadsheet size={16} /> {pending ? "جاري الفحص..." : "1. افحص الملف"}</button>
          {r?.mode === "check" && r.errors.length === 0 && (r.newClients > 0 || r.newCompanies > 0) && (
            <button type="button" disabled={pending} onClick={() => submit("commit")} className="btn-primary">
              <Upload size={16} /> 2. استيراد ({r.newClients} عميل، {r.newCompanies} شركة)
            </button>
          )}
        </div>
      </form>

      {r && (
        <div className="card p-5 space-y-4">
          {r.mode === "commit" ? (
            <p className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 size={20} /> تم الاستيراد بنجاح 🎉</p>
          ) : r.errors.length ? (
            <p className="flex items-center gap-2 text-rose-700 font-semibold"><XCircle size={20} /> توجد أخطاء في الملف — يرجى تصحيحها وإعادة الفحص. لم يتم حفظ أي بيانات.</p>
          ) : (
            <p className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 size={20} /> الملف سليم — راجع الملخص ثم اضغط &quot;استيراد&quot;</p>
          )}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 text-center">
            {[["صفوف", r.rows], ["عملاء جدد", r.newClients], ["مسجّلون مسبقاً", r.existingClients], ["شركات جديدة", r.newCompanies]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-neutral-50 p-3"><div className="text-xl font-bold">{v}</div><div className="text-xs text-neutral-500">{l}</div></div>
            ))}
          </div>
          {r.errors.length > 0 && (
            <div>
              <h3 className="font-semibold text-rose-700 mb-2">الأخطاء ({r.errors.length})</h3>
              <ul className="text-sm space-y-1 max-h-72 overflow-y-auto">
                {r.errors.map((e, i) => <li key={i} className="rounded bg-rose-50 px-3 py-1.5">صف {e.row}: {e.msg}</li>)}
              </ul>
            </div>
          )}
          {r.notes.length > 0 && (
            <div>
              <h3 className="font-semibold text-amber-700 mb-2">ملاحظات ({r.notes.length})</h3>
              <ul className="text-sm space-y-1 max-h-72 overflow-y-auto">
                {r.notes.map((e, i) => <li key={i} className="rounded bg-amber-50 px-3 py-1.5">صف {e.row}: {e.msg}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
