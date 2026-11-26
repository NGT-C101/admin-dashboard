"use client";

// نموذج الخطاب الصادر: اختيار قالب يملأ الموضوع والنص، ثم التعديل بحرية
import { useState } from "react";
import { Field, FieldGrid } from "@/components/ui/Field";

type Tpl = { id: string; name: string; subject: string | null; body: string };
type Letter = { subject: string; party: string; partyRef: string | null; body: string | null; clientId: string | null; hideLogo: boolean };

export default function LetterFields({ templates, clients, letter }: {
  templates: Tpl[];
  clients: { id: string; name: string }[];
  letter?: Letter;
}) {
  const [subject, setSubject] = useState(letter?.subject ?? "");
  const [body, setBody] = useState(letter?.body ?? "");

  return (
    <FieldGrid>
      {!letter && templates.length > 0 && (
        <Field label="قالب جاهز (اختياري)" wide>
          <select
            defaultValue=""
            className="input"
            onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              if (!t) return;
              if (body.trim() && !confirm("سيُستبدل النص الحالي بنص القالب. هل تريد المتابعة؟")) return;
              setBody(t.body);
              if (t.subject) setSubject(t.subject);
            }}
          >
            <option value="">— بدون قالب —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="الجهة الموجّه إليها الخطاب *">
        <input name="party" required defaultValue={letter?.party} placeholder="مثال: وزارة الموارد البشرية والتنمية الاجتماعية" className="input" />
      </Field>
      <Field label="الموضوع *">
        <input name="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
      </Field>
      <Field label="رقم مرجعي (اختياري)">
        <input name="partyRef" defaultValue={letter?.partyRef ?? ""} placeholder="مثال: رقم خطابهم الذي نرد عليه" className="input" />
      </Field>
      <Field label="العميل المرتبط (اختياري)">
        <select name="clientId" defaultValue={letter?.clientId ?? ""} className="input">
          <option value="">— لا يوجد —</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="نص الخطاب *" wide>
        <textarea
          name="body" required rows={14} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={"السلام عليكم ورحمة الله وبركاته، وبعد:\n\n...\n\nوتقبلوا خالص التحية والتقدير،"}
          className="input leading-loose"
        />
        <span className="text-xs text-neutral-500">استبدل ما بين القوسين [ ] في القالب بالبيانات الصحيحة قبل الإرسال للمراجعة.</span>
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
        <input type="checkbox" name="hideLogo" defaultChecked={letter?.hideLogo} className="size-4 accent-brand-600" />
        طباعة الخطاب دون شعار المنشأة (للطباعة على ورق رسمي مطبوع مسبقاً)
      </label>
    </FieldGrid>
  );
}
