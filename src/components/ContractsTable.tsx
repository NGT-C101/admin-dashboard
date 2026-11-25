import Link from "next/link";
import type { Prisma } from "@prisma/client";
import Badge from "@/components/ui/Badge";
import { CONTRACT_STATE_LABELS, CONTRACT_STATE_STYLES, CONTRACT_TYPE_LABELS, contractState } from "@/lib/clients";
import { formatDate, formatSAR } from "@/lib/format";

export const CONTRACT_INCLUDE = {
  client: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} satisfies Prisma.ContractInclude;
export type ContractRow = Prisma.ContractGetPayload<{ include: typeof CONTRACT_INCLUDE }>;

export const contractNumber = (n: number) => `C-${String(n).padStart(4, "0")}`;

export default function ContractsTable({ contracts, showClient }: { contracts: ContractRow[]; showClient?: boolean }) {
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr><th>الرقم</th><th>العقد</th>{showClient && <th>العميل</th>}<th>النوع</th><th>القيمة</th><th>المدة</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          {contracts.map((c) => {
            const st = contractState(c);
            return (
              <tr key={c.id}>
                <td dir="ltr" className="text-right whitespace-nowrap"><Link href={`/clients/contracts/${c.id}`} className="link">{contractNumber(c.number)}</Link></td>
                <td>
                  <Link href={`/clients/contracts/${c.id}`} className="hover:underline">{c.title}</Link>
                  {c.company && <div className="text-xs text-neutral-500">{c.company.name}</div>}
                </td>
                {showClient && <td><Link href={`/clients/directory/${c.client.id}`} className="hover:underline">{c.client.name}</Link></td>}
                <td>{CONTRACT_TYPE_LABELS[c.type]}{c.autoRenew && <div className="text-xs text-neutral-500">تجديد تلقائي</div>}</td>
                <td className="whitespace-nowrap">{formatSAR(c.value)}{c.type === "MONTHLY" && c.value && <span className="text-xs text-neutral-500"> / شهر</span>}</td>
                <td className="text-xs whitespace-nowrap">{formatDate(c.startDate)}<br />← {c.endDate ? formatDate(c.endDate) : "مفتوح"}</td>
                <td><Badge className={CONTRACT_STATE_STYLES[st]}>{CONTRACT_STATE_LABELS[st]}</Badge></td>
              </tr>
            );
          })}
          {contracts.length === 0 && <tr><td colSpan={7} className="text-center text-neutral-500 py-8">مفيش عقود</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
