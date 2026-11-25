import Link from "next/link";
import type { Prisma } from "@prisma/client";
import StageBadge from "@/components/ui/StageBadge";
import { formatDate, txNumber } from "@/lib/format";

export const TX_INCLUDE = {
  company: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
  stage: true,
  serviceType: { select: { name: true } },
  govEntity: { select: { name: true } },
  assignee: { select: { name: true } },
} satisfies Prisma.TransactionInclude;

export type TxRow = Prisma.TransactionGetPayload<{ include: typeof TX_INCLUDE }>;

export function isOverdue(t: Pick<TxRow, "dueDate" | "stage">) {
  return !!t.dueDate && t.stage.kind === "OPEN" && t.dueDate < new Date();
}

export default function TransactionsTable({ transactions, showCompany }: { transactions: TxRow[]; showCompany?: boolean }) {
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>الرقم</th><th>المعاملة</th>{showCompany && <th>الشركة</th>}
            <th>الجهة</th><th>المرحلة</th><th>المسؤول</th><th>الموعد</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td dir="ltr" className="text-right whitespace-nowrap">
                <Link href={`/requests/all/${t.id}`} className="link">{txNumber(t.number)}</Link>
              </td>
              <td>
                <Link href={`/requests/all/${t.id}`} className="hover:underline">{t.title}</Link>
                {t.serviceType && <div className="text-xs text-neutral-500">{t.serviceType.name}</div>}
              </td>
              {showCompany && (
                <td>
                  <Link href={`/clients/companies/${t.company.id}`} className="hover:underline">{t.company.name}</Link>
                  <div className="text-xs text-neutral-500">{t.company.client.name}</div>
                </td>
              )}
              <td className="text-neutral-600">{t.govEntity?.name ?? "—"}</td>
              <td><StageBadge name={t.stage.name} kind={t.stage.kind} /></td>
              <td>{t.assignee?.name ?? <span className="text-neutral-400">غير محدد</span>}</td>
              <td className={`whitespace-nowrap ${isOverdue(t) ? "text-rose-600 font-semibold" : ""}`}>
                {formatDate(t.dueDate)}{isOverdue(t) && " ⚠️"}
              </td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr><td colSpan={7} className="text-center text-neutral-500 py-10">لا توجد معاملات</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
