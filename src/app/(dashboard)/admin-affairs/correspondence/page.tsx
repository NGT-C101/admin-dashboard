import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Inbox, Send } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import { Field, FieldGrid } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import SearchBox from "@/components/ui/SearchBox";
import Tabs from "@/components/ui/Tabs";
import { can, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { SECTION, STATUS_LABELS, STATUS_STYLES, letterNumber, myQueueWhere } from "@/lib/letters";
import { currentMonthKey, dateKey, monthBounds, riyadhToday } from "@/lib/time";
import { saveTemplate } from "./actions";

type SP = { tab?: string; q?: string; status?: string; year?: string };
const TABS = ["out", "in", "queue", "templates"] as const;

export default async function CorrespondencePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection(SECTION);
  const sp = await searchParams;
  const manage = can(user, SECTION, "MANAGE");
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") && (sp.tab !== "templates" || manage) ? sp.tab! : "out";
  const year = Number(sp.year) || Number(dateKey(riyadhToday()).slice(0, 4));
  const q = sp.q?.trim();
  const n = q ? Number(q.replace(/\D/g, "").slice(-4)) : 0;

  const search: Prisma.LetterWhereInput = q ? { OR: [
    { subject: { contains: q, mode: "insensitive" } },
    { party: { contains: q, mode: "insensitive" } },
    { partyRef: { contains: q, mode: "insensitive" } },
    ...(n ? [{ seq: n }] : []),
  ] } : {};
  const where: Prisma.LetterWhereInput =
    tab === "queue" ? myQueueWhere(user)
    : {
        direction: tab === "in" ? "INCOMING" : "OUTGOING",
        ...(sp.status === "mine" ? { createdById: user.id }
          : sp.status === "assigned" ? { assigneeId: user.id, actionDone: false }
          : sp.status ? { status: sp.status as Prisma.EnumLetterStatusFilter["equals"] } : {}),
        // المعتمد والوارد مرقّمان بالسنة، والمسودات تظهر دائماً
        AND: [search, { OR: [{ year }, { year: null }] }],
      };

  const { start, end } = monthBounds(currentMonthKey());
  const [letters, queueCount, outYear, inMonth, myDrafts, templates] = await Promise.all([
    tab === "templates" ? [] : db.letter.findMany({
      where,
      include: { createdBy: { select: { name: true } }, assignee: { select: { name: true } } },
      orderBy: [{ seq: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      take: 300,
    }),
    db.letter.count({ where: myQueueWhere(user) }),
    db.letter.count({ where: { direction: "OUTGOING", status: "APPROVED", year } }),
    db.letter.count({ where: { direction: "INCOMING", receivedAt: { gte: start, lt: end }, status: { not: "CANCELLED" } } }),
    db.letter.count({ where: { createdById: user.id, status: { in: ["DRAFT", "RETURNED"] } } }),
    tab === "templates" ? db.letterTemplate.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] }) : [],
  ]);

  const kpis = [
    { label: "بانتظار مراجعتي أو اعتمادي", value: queueCount },
    { label: `الصادر المعتمد في ${year}`, value: outYear },
    { label: "الوارد هذا الشهر", value: inMonth },
    { label: "مسوداتي والمُعاد لي", value: myDrafts },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="الصادر والوارد"
        crumbs={[{ label: "الشؤون الإدارية" }, { label: "الصادر والوارد" }]}
        actions={can(user, SECTION, "EDIT") && (
          <div className="flex flex-wrap gap-2">
            <Link href="/admin-affairs/correspondence/new" className="btn-primary"><Send size={16} /> خطاب صادر</Link>
            <Link href="/admin-affairs/correspondence/new?dir=in" className="btn-secondary"><Inbox size={16} /> تسجيل وارد</Link>
          </div>
        )}
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card-dark p-4">
            <div className="text-sm text-navy-100">{k.label}</div>
            <div className="stat-value text-white">{k.value}</div>
          </div>
        ))}
      </div>

      <Tabs base="/admin-affairs/correspondence" current={tab} tabs={[
        { key: "out", label: "الصادر" },
        { key: "in", label: "الوارد" },
        { key: "queue", label: "بانتظار إجرائي", count: queueCount },
        ...(manage ? [{ key: "templates", label: "قوالب الخطابات" }] : []),
      ]} />

      {tab === "templates" ? <Templates templates={templates} /> : (
        <>
          {tab !== "queue" && (
            <SearchBox placeholder="الموضوع، الجهة، الرقم المرجعي، رقم الخطاب" defaultValue={q}>
              <input type="hidden" name="tab" value={tab} />
              <select name="status" defaultValue={sp.status ?? ""} className="input w-auto">
                <option value="">كل الحالات</option>
                {tab === "out" ? (
                  <>
                    <option value="mine">خطاباتي</option>
                    {(["DRAFT", "IN_REVIEW", "REVIEWED", "RETURNED", "APPROVED", "CANCELLED"] as const).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </>
                ) : (
                  <>
                    <option value="assigned">المحال إليّ ولم يُنجز</option>
                    <option value="RECEIVED">مسجّل</option>
                    <option value="CANCELLED">ملغى</option>
                  </>
                )}
              </select>
              <input name="year" type="number" min={2020} max={2100} defaultValue={year} className="input w-28" dir="ltr" title="السنة" />
            </SearchBox>
          )}
          <div className="card overflow-x-auto">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th>الرقم</th><th>الموضوع</th><th>{tab === "in" ? "من" : "إلى"}</th><th>التاريخ</th>
                  <th>{tab === "in" ? "المحال إليه" : "الكاتب"}</th><th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {letters.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-neutral-500">لا توجد خطابات</td></tr>}
                {letters.map((l) => (
                  <tr key={l.id} className="hover:bg-neutral-50">
                    <td className="whitespace-nowrap font-semibold">
                      <Link href={`/admin-affairs/correspondence/${l.id}`} className="link">{letterNumber(l) ?? "—"}</Link>
                    </td>
                    <td><Link href={`/admin-affairs/correspondence/${l.id}`} className="hover:underline">{l.subject}</Link></td>
                    <td>{l.party}</td>
                    <td className="whitespace-nowrap">{formatDate(l.direction === "INCOMING" ? l.receivedAt : l.letterDate ?? l.createdAt)}</td>
                    <td>
                      {l.direction === "INCOMING" ? (l.assignee?.name ?? "—") : l.createdBy.name}
                      {l.direction === "INCOMING" && l.assignee && <div className={`text-xs ${l.actionDone ? "text-emerald-700" : "text-amber-700"}`}>{l.actionDone ? "تم الإجراء" : "لم يُنجز بعد"}</div>}
                    </td>
                    <td><Badge className={STATUS_STYLES[l.status]}>{STATUS_LABELS[l.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function TemplateFields({ t, nextOrder }: { t?: { id: string; name: string; subject: string | null; body: string; order: number; active: boolean }; nextOrder?: number }) {
  return (
    <FieldGrid>
      {t && <input type="hidden" name="id" value={t.id} />}
      <Field label="اسم القالب *"><input name="name" required defaultValue={t?.name} className="input" /></Field>
      <Field label="الموضوع الافتراضي"><input name="subject" defaultValue={t?.subject ?? ""} className="input" /></Field>
      <Field label="الترتيب"><input name="order" type="number" min={0} defaultValue={t?.order ?? nextOrder ?? 0} className="input" /></Field>
      <Field label="النص *" wide><textarea name="body" required rows={10} defaultValue={t?.body} className="input leading-loose" /></Field>
      {t && (
        <Field label="الحالة">
          <select name="active" defaultValue={t.active ? "on" : "off"} className="input">
            <option value="on">مفعّل</option>
            <option value="off">موقوف</option>
          </select>
        </Field>
      )}
    </FieldGrid>
  );
}

function Templates({ templates }: { templates: { id: string; name: string; subject: string | null; body: string; order: number; active: boolean }[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">القوالب تظهر عند كتابة خطاب صادر وتملأ الموضوع والنص. ضع ما يتغيّر بين قوسين [ ] ليستبدله الكاتب.</p>
      {templates.map((t) => (
        <details key={t.id} className={`card ${t.active ? "" : "opacity-60"}`}>
          <summary className="cursor-pointer select-none p-4 font-semibold">{t.name}{!t.active && " (موقوف)"}</summary>
          <div className="border-t border-neutral-100 p-4">
            <ActionForm action={saveTemplate} submitLabel="حفظ القالب" resetOnSuccess={false}><TemplateFields t={t} /></ActionForm>
          </div>
        </details>
      ))}
      <Collapsible label="إضافة قالب">
        <ActionForm action={saveTemplate} submitLabel="إضافة القالب">
          <TemplateFields nextOrder={templates.length} />
        </ActionForm>
      </Collapsible>
    </div>
  );
}
