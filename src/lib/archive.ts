// الأرشيف: بحث موحّد في كل مستندات المنصة، كلٌّ حسب صلاحية القسم الذي يتبعه
import type { DocType, Prisma } from "@prisma/client";
import { type CurrentUser, can } from "@/lib/auth";
import { DOC_TYPE_LABELS } from "@/lib/documents";
import { txNumber } from "@/lib/format";
import { letterNumber } from "@/lib/letters";
import { DAY_MS, riyadhToday } from "@/lib/time";
import { visibleTxWhere } from "@/lib/transactions";

export const OWNER_LABELS = {
  client: "عميل", company: "شركة", contract: "عقد", employee: "موظف", transaction: "معاملة", letter: "خطاب",
} as const;
export type OwnerKind = keyof typeof OWNER_LABELS;
export const EXPIRY_SOON_DAYS = 60;

export type ArchiveFilters = { q?: string; type?: string; owner?: string; expiry?: string };

// المستندات المسموح للمستخدم برؤيتها (نفس قواعد فتح الملف في /api/files)
function visibleWhere(user: CurrentUser): Prisma.DocumentWhereInput[] {
  const or: Prisma.DocumentWhereInput[] = [];
  if (can(user, "clients")) {
    or.push({ OR: [{ clientId: { not: null } }, { companyId: { not: null } }, { contractId: { not: null } }] });
  }
  if (can(user, "employees", "MANAGE")) or.push({ employeeId: { not: null } });
  else if (user.employeeId) or.push({ employeeId: user.employeeId });
  // ملاحظة: شرط العلاقة الفارغ ({}) سلوكه غير ثابت داخل OR في Prisma، فمدير النظام يأخذ كل مخرجات المعاملات صراحةً
  if (can(user, "requests")) {
    or.push(user.isAdmin ? { transactionId: { not: null } } : { transactionId: { not: null }, transaction: { is: visibleTxWhere(user) } });
  }
  if (can(user, "admin-affairs")) or.push({ letterId: { not: null } });
  return or;
}

const OWNER_WHERE: Record<OwnerKind, Prisma.DocumentWhereInput> = {
  client: { clientId: { not: null } },
  company: { companyId: { not: null } },
  contract: { contractId: { not: null } },
  employee: { employeeId: { not: null } },
  transaction: { transactionId: { not: null } },
  letter: { letterId: { not: null } },
};

export function archiveWhere(user: CurrentUser, f: ArchiveFilters): Prisma.DocumentWhereInput {
  const visible = visibleWhere(user);
  if (visible.length === 0) return { id: "__none__" };
  const and: Prisma.DocumentWhereInput[] = [{ OR: visible }];

  const q = f.q?.trim();
  if (q) {
    const n = Number(q.replace(/\D/g, ""));
    const types = (Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).filter(([, l]) => l.includes(q)).map(([k]) => k);
    and.push({ OR: [
      { title: { contains: q, mode: "insensitive" } },
      { fileName: { contains: q, mode: "insensitive" } },
      ...(types.length ? [{ type: { in: types } }] : []),
      { client: { name: { contains: q, mode: "insensitive" } } },
      { client: { nationalId: { contains: q } } },
      { company: { name: { contains: q, mode: "insensitive" } } },
      { company: { crNumber: { contains: q } } },
      { company: { client: { name: { contains: q, mode: "insensitive" } } } },
      { contract: { title: { contains: q, mode: "insensitive" } } },
      { contract: { client: { name: { contains: q, mode: "insensitive" } } } },
      { employee: { fullName: { contains: q, mode: "insensitive" } } },
      { transaction: { title: { contains: q, mode: "insensitive" } } },
      { transaction: { company: { name: { contains: q, mode: "insensitive" } } } },
      { letter: { subject: { contains: q, mode: "insensitive" } } },
      { letter: { party: { contains: q, mode: "insensitive" } } },
      ...(n ? [{ transaction: { number: n } }, { contract: { number: n } }] : []),
    ] });
  }
  if (f.type && f.type in DOC_TYPE_LABELS) and.push({ type: f.type as DocType });
  if (f.owner && f.owner in OWNER_WHERE) and.push(OWNER_WHERE[f.owner as OwnerKind]);

  const today = riyadhToday();
  if (f.expiry === "expired") and.push({ expiresAt: { lt: today } });
  if (f.expiry === "soon") and.push({ expiresAt: { gte: today, lt: new Date(today.getTime() + EXPIRY_SOON_DAYS * DAY_MS) } });
  if (f.expiry === "valid") and.push({ expiresAt: { gte: today } });
  if (f.expiry === "none") and.push({ expiresAt: null });
  return { AND: and };
}

export const ARCHIVE_INCLUDE = {
  uploadedBy: { select: { name: true } },
  client: { select: { id: true, name: true } },
  company: { select: { id: true, name: true, client: { select: { name: true } } } },
  contract: { select: { id: true, number: true, title: true, client: { select: { name: true } } } },
  employee: { select: { id: true, fullName: true } },
  transaction: { select: { id: true, number: true, title: true, company: { select: { name: true } } } },
  letter: { select: { id: true, direction: true, year: true, seq: true, subject: true } },
} satisfies Prisma.DocumentInclude;
export type ArchiveDoc = Prisma.DocumentGetPayload<{ include: typeof ARCHIVE_INCLUDE }>;

// صاحب المستند: النوع، الاسم، الرابط، وسطر توضيحي
export function ownerOf(d: ArchiveDoc): { kind: OwnerKind; name: string; href: string; sub?: string } {
  if (d.letter) {
    const n = letterNumber(d.letter);
    return { kind: "letter", name: d.letter.subject, href: `/admin-affairs/correspondence/${d.letter.id}`, sub: n ?? (d.letter.direction === "OUTGOING" ? "صادر غير معتمد" : "وارد") };
  }
  if (d.transaction) return { kind: "transaction", name: d.transaction.title, href: `/requests/all/${d.transaction.id}`, sub: `${txNumber(d.transaction.number)} · ${d.transaction.company.name}` };
  if (d.employee) return { kind: "employee", name: d.employee.fullName, href: `/employees/profiles/${d.employee.id}?tab=documents` };
  if (d.contract) return { kind: "contract", name: d.contract.title, href: `/clients/contracts/${d.contract.id}`, sub: d.contract.client.name };
  if (d.company) return { kind: "company", name: d.company.name, href: `/clients/companies/${d.company.id}?tab=documents`, sub: d.company.client.name };
  return { kind: "client", name: d.client?.name ?? "—", href: d.client ? `/clients/directory/${d.client.id}?tab=documents` : "#" };
}
