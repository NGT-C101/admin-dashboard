import Link from "next/link";
import type { Prisma } from "@prisma/client";
import ActionForm from "@/components/ui/ActionForm";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import SearchBox from "@/components/ui/SearchBox";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { createClient } from "../actions";
import { ClientFields } from "../fields";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSection("clients");
  const { q } = await searchParams;

  const where: Prisma.ClientWhereInput = q
    ? { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { nationalId: { contains: q } },
        { phone: { contains: q } },
        { companies: { some: { OR: [{ name: { contains: q, mode: "insensitive" } }, { crNumber: { contains: q } }] } } },
      ] }
    : {};

  const clients = await db.client.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { companies: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="العملاء" crumbs={[{ label: "العملاء" }]} />

      <Collapsible label="إضافة عميل جديد">
        <ActionForm action={createClient} submitLabel="حفظ العميل">
          <ClientFields />
        </ActionForm>
      </Collapsible>

      <SearchBox placeholder="ابحث بالاسم أو الهوية أو الجوال أو اسم الشركة أو السجل التجاري" defaultValue={q} />

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>الاسم</th><th>رقم الهوية</th><th>الجوال</th><th>عدد الشركات</th></tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/clients/directory/${c.id}`} className="link">{c.name}</Link></td>
                <td dir="ltr" className="text-right">{c.nationalId ?? "—"}</td>
                <td dir="ltr" className="text-right">{c.phone ?? "—"}</td>
                <td>{c._count.companies}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={4} className="text-center text-neutral-500 py-10">
                {q ? "مفيش نتايج للبحث ده" : "لسه مفيش عملاء — ابدأ بإضافة أول عميل"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
