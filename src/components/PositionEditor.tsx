"use client";

// إضافة منصب أو تعديله (بيملأ البيانات تلقائياً عند اختيار منصب قائم)
import { useState } from "react";
import ActionForm from "@/components/ui/ActionForm";
import { Field, FieldGrid } from "@/components/ui/Field";
import { savePosition } from "@/app/(dashboard)/employees/position-actions";

type P = { id: string; title: string; level: string; scope: string | null; parentId: string | null; order: number };

export default function PositionEditor({ positions, levels }: { positions: P[]; levels: [string, string][] }) {
  const empty = { title: "", level: "DEPARTMENT", scope: "", parentId: "", order: String(positions.length) };
  const [id, setId] = useState("");
  const [f, setF] = useState(empty);
  const pick = (v: string) => {
    setId(v);
    const p = positions.find((x) => x.id === v);
    setF(p ? { title: p.title, level: p.level, scope: p.scope ?? "", parentId: p.parentId ?? "", order: String(p.order) } : empty);
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <ActionForm action={savePosition} submitLabel={id ? "حفظ التعديل" : "إضافة المنصب"} resetOnSuccess={false}>
      <FieldGrid>
        <Field label="المنصب">
          <select name="id" value={id} onChange={(e) => pick(e.target.value)} className="input">
            <option value="">+ منصب جديد</option>
            {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </Field>
        <Field label="مسمى المنصب *"><input name="title" required value={f.title} onChange={set("title")} placeholder="مثال: مدير الجودة" className="input" /></Field>
        <Field label="المستوى">
          <select name="level" value={f.level} onChange={set("level")} className="input">
            {levels.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="يتبع لـ">
          <select name="parentId" value={f.parentId} onChange={set("parentId")} className="input">
            <option value="">— أعلى الهيكل —</option>
            {positions.filter((p) => p.id !== id).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </Field>
        <Field label="الترتيب"><input name="order" type="number" min={0} value={f.order} onChange={set("order")} className="input" /></Field>
        <Field label="نطاق المسؤولية" wide><input name="scope" value={f.scope} onChange={set("scope")} className="input" /></Field>
      </FieldGrid>
    </ActionForm>
  );
}
