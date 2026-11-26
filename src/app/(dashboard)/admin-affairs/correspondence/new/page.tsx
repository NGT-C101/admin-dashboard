import LetterFields from "@/components/LetterForm";
import ActionForm from "@/components/ui/ActionForm";
import DateField from "@/components/ui/DateField";
import { Field, FieldGrid } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { SECTION } from "@/lib/letters";
import { dateKey, riyadhToday } from "@/lib/time";
import { registerIncoming, saveOutgoing } from "../actions";

export default async function NewLetterPage({ searchParams }: { searchParams: Promise<{ dir?: string }> }) {
  await requireSection(SECTION, "EDIT");
  const incoming = (await searchParams).dir === "in";
  const [clients, templates, users] = await Promise.all([
    db.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    incoming ? [] : db.letterTemplate.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true, subject: true, body: true } }),
    incoming ? db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  const title = incoming ? "تسجيل خطاب وارد" : "خطاب صادر جديد";

  return (
    <div className="space-y-6">
      <PageHeader title={title} crumbs={[{ label: "الصادر والوارد", href: "/admin-affairs/correspondence" }, { label: title }]} />
      <div className="card p-5">
        {incoming ? (
          <ActionForm action={registerIncoming} submitLabel="تسجيل الوارد">
            <FieldGrid>
              <Field label="الجهة المرسلة *"><input name="party" required className="input" /></Field>
              <Field label="الموضوع *"><input name="subject" required className="input" /></Field>
              <Field label="رقم خطابهم"><input name="partyRef" dir="auto" className="input" /></Field>
              <Field label="تاريخ الخطاب"><DateField name="letterDate" /></Field>
              <Field label="تاريخ الاستلام *"><DateField name="receivedAt" required defaultValue={dateKey(riyadhToday())} /></Field>
              <Field label="إحالة إلى موظف (اختياري)">
                <select name="assigneeId" defaultValue="" className="input">
                  <option value="">— بدون إحالة —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
              <Field label="العميل المرتبط (اختياري)">
                <select name="clientId" defaultValue="" className="input">
                  <option value="">— لا يوجد —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="ملخص الخطاب" wide><textarea name="body" rows={4} className="input" /></Field>
            </FieldGrid>
            <p className="text-sm text-neutral-500">بعد التسجيل يمكنك رفع صورة الخطاب الوارد من صفحته.</p>
          </ActionForm>
        ) : (
          <ActionForm action={saveOutgoing} submitLabel="حفظ كمسودة">
            <LetterFields templates={templates} clients={clients} />
            <p className="text-sm text-neutral-500">يُحفظ الخطاب كمسودة، ثم تُرسله للمراجعة من صفحته. يحصل على رقم صادر عند اعتماده.</p>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
