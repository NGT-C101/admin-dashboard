import Link from "next/link";
import type { Prisma } from "@prisma/client";
import ActionForm from "@/components/ui/ActionForm";
import Collapsible from "@/components/ui/Collapsible";
import PageHeader from "@/components/ui/PageHeader";
import SearchBox from "@/components/ui/SearchBox";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { createCompany } from "../actions";
import { CompanyFields } from "../fields";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireSection("clients");
  const { q } = await searchParams;

  const where: Prisma.CompanyWhereInput = q
    ? { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { crNumber: { contains: q } },
        { unifiedNumber: { contains: q } },
        { client: { name: { contains: q, mode: "insensitive" } } },
      ] }
    : {};

  const [companies, clients] = await Promise.all([
    db.company.findMany({
      where, orderBy: { createdAt: "desc" }, take: 200,
      include: { client: { select: { id: true, name: true } }, _count: { select: { transactions: true } } },
    }),
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const soon = new Date(Date.now() + 30 * 24 * 3600 * 1000);

  return (
    <div className="space-y-6">
      <PageHeader title="الشركات" crumbs={[{ label: "العملاء", href: "/clients/directory" }, { label: "الشركات" }]} />

      <Collapsible label="إضافة شركة جديدة">
        {clients.length === 0 ? (
          <p className="text-sm text-neutral-600">
            لازم تضيف <Link href="/clients/directory" className="link">العميل</Link> الأول، وبعدين تضيف شركاته.
          </p>
        ) : (
          <ActionForm action={createCompany} submitLabel="حفظ الشركة">
            <CompanyFields clients={clients} />
          </ActionForm>
        )}
      </Collapsible>

      <SearchBox placeholder="ابحث باسم الشركة أو السجل التجاري أو الرقم الموحد أو اسم العميل" defaultValue={q} />

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>الشركة</th><th>المالك</th><th>السجل التجاري</th><th>المدينة</th><th>انتهاء السجل</th><th>المعاملات</th></tr>
          </thead>
          <tbody>
            {companies.map((co) => (
              <tr key={co.id}>
                <td><Link href={`/clients/companies/${co.id}`} className="link">{co.name}</Link></td>
                <td><Link href={`/clients/directory/${co.client.id}`} className="hover:underline">{co.client.name}</Link></td>
                <td dir="ltr" className="text-right">{co.crNumber ?? "—"}</td>
                <td>{co.city ?? "—"}</td>
                <td className={co.crExpiry && co.crExpiry < soon ? "text-rose-600 font-medium" : ""}>{formatDate(co.crExpiry)}</td>
                <td>{co._count.transactions}</td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr><td colSpan={6} className="text-center text-neutral-500 py-10">{q ? "مفيش نتايج" : "لسه مفيش شركات"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">التاريخ باللون الأحمر = السجل منتهي أو هينتهي خلال 30 يوم</p>
    </div>
  );
}
