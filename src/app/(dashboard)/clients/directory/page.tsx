import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { FileDown, FileUp, MessageCircle, Star } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import SearchBox from "@/components/ui/SearchBox";
import { can, requireSection } from "@/lib/auth";
import { CLIENT_STATUS_LABELS, CLIENT_STATUS_STYLES, whatsappLink } from "@/lib/clients";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { createClient } from "../actions";
import { ClientFields } from "../fields";

type SP = { q?: string; status?: string; manager?: string; vip?: string; archived?: string };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireSection("clients");
  const sp = await searchParams;

  const and: Prisma.ClientWhereInput[] = [];
  if (sp.q) and.push({ OR: [
    { name: { contains: sp.q, mode: "insensitive" } },
    { nationalId: { contains: sp.q } },
    { phone: { contains: sp.q } },
    { phone2: { contains: sp.q } },
    { city: { contains: sp.q, mode: "insensitive" } },
    { companies: { some: { OR: [
      { name: { contains: sp.q, mode: "insensitive" } }, { crNumber: { contains: sp.q } },
      { unifiedNumber: { contains: sp.q } }, { vatNumber: { contains: sp.q } },
    ] } } },
  ] });
  if (sp.status) and.push({ status: sp.status as never });
  if (sp.manager === "me") and.push({ accountManagerId: user.id });
  else if (sp.manager === "none") and.push({ accountManagerId: null });
  else if (sp.manager) and.push({ accountManagerId: sp.manager });
  if (sp.vip) and.push({ vip: true });
  and.push({ archivedAt: sp.archived ? { not: null } : null });

  const [clients, users, counts] = await Promise.all([
    db.client.findMany({
      where: { AND: and },
      orderBy: [{ vip: "desc" }, { createdAt: "desc" }],
      take: 300,
      include: {
        accountManager: { select: { name: true } },
        companies: { select: { id: true, name: true, crNumber: true }, orderBy: { createdAt: "asc" } },
        interactions: { select: { occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 1 },
        _count: { select: { documents: true } },
      },
    }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.client.groupBy({ by: ["status"], where: { archivedAt: null }, _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="العملاء" crumbs={[{ label: "العملاء" }]} actions={
        <>
          {/* تحميل ملف: لازم رابط عادي مش تنقّل بين الصفحات */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/export/clients" className="btn-secondary"><FileDown size={16} /> تصدير Excel</a>
          {can(user, "clients", "EDIT") && <Link href="/clients/import" className="btn-secondary"><FileUp size={16} /> استيراد</Link>}
        </>
      } />

      <div className="flex flex-wrap gap-2 text-sm">
        {[["", "الكل", counts.reduce((a, c) => a + c._count, 0)], ["ACTIVE", "نشط", countOf("ACTIVE")], ["LEAD", "محتمل", countOf("LEAD")], ["INACTIVE", "متوقف", countOf("INACTIVE")]].map(([v, l, n]) => (
          <Link key={v as string} href={v ? `?status=${v}` : "?"}
            className={`rounded-full px-3 py-1 ring-1 ${(sp.status ?? "") === v ? "bg-brand-700 text-white ring-brand-700" : "bg-white ring-neutral-200 hover:bg-neutral-50"}`}>
            {l} ({n})
          </Link>
        ))}
      </div>

      {can(user, "clients", "EDIT") && (
        <Collapsible label="إضافة عميل جديد">
          <ActionForm action={createClient} submitLabel="حفظ العميل">
            <ClientFields users={users} />
          </ActionForm>
        </Collapsible>
      )}

      <SearchBox placeholder="الاسم، الهوية، الجوال، المدينة، الشركة، السجل، الرقم الموحد أو الضريبي" defaultValue={sp.q}>
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <select name="manager" defaultValue={sp.manager ?? ""} className="input w-auto">
          <option value="">كل المسؤولين</option>
          <option value="me">عملائي</option>
          <option value="none">بدون مسؤول</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm px-2">
          <input type="checkbox" name="vip" value="1" defaultChecked={!!sp.vip} className="size-4 accent-brand-600" /> المميزون فقط
        </label>
        <label className="flex items-center gap-1.5 text-sm px-2">
          <input type="checkbox" name="archived" value="1" defaultChecked={!!sp.archived} className="size-4 accent-brand-600" />المؤرشفون
        </label>
      </SearchBox>

      <p className="text-sm text-neutral-500">{clients.length} عميل</p>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>العميل</th><th>الحالة</th><th>الجوال</th><th>الشركات والسجل التجاري</th><th>المسؤول</th><th>آخر تواصل</th><th>المستندات</th></tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const wa = whatsappLink(c.phone);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clients/directory/${c.id}`} className="link">{c.name}</Link>
                    {c.vip && <Star size={14} className="inline mr-1 text-amber-500 fill-amber-400" />}
                    {c.city && <div className="text-xs text-neutral-500">{c.city}</div>}
                  </td>
                  <td><Badge className={CLIENT_STATUS_STYLES[c.status]}>{CLIENT_STATUS_LABELS[c.status]}</Badge></td>
                  <td className="whitespace-nowrap">
                    {c.phone ? (
                      <span className="flex items-center gap-2">
                        <span dir="ltr">{c.phone}</span>
                        {wa && <a href={wa} target="_blank" rel="noopener" title="واتساب" className="text-emerald-600"><MessageCircle size={15} /></a>}
                      </span>
                    ) : "—"}
                  </td>
                  <td>
                    {c.companies.length === 0 && <span className="text-neutral-400">—</span>}
                    {c.companies.map((co) => (
                      <div key={co.id} className="flex flex-wrap gap-x-2">
                        <Link href={`/clients/companies/${co.id}`} className="hover:underline">{co.name}</Link>
                        {co.crNumber && <span className="text-xs text-neutral-500" dir="ltr">{co.crNumber}</span>}
                      </div>
                    ))}
                  </td>
                  <td>{c.accountManager?.name ?? <span className="text-neutral-400">—</span>}</td>
                  <td className="text-xs whitespace-nowrap">{c.interactions[0] ? formatDate(c.interactions[0].occurredAt) : <span className="text-neutral-400">—</span>}</td>
                  <td>{c._count.documents}</td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr><td colSpan={7} className="text-center text-neutral-500 py-10">
                {sp.q || sp.status || sp.manager || sp.vip ? "لا توجد نتائج" : "لا يوجد عملاء بعد — ابدأ بإضافة أول عميل"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
