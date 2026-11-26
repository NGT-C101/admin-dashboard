import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Printer } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import { acknowledgeCustody } from "@/app/(dashboard)/admin-affairs/assets/actions";
import { CUSTODY_STATUS_LABELS, CUSTODY_STATUS_STYLES, assetNumber, custodyPledge } from "@/lib/assets";
import { formatDate } from "@/lib/format";

export const CUSTODY_INCLUDE = {
  asset: { select: { id: true, number: true, name: true, serialNumber: true, brand: true } },
} satisfies Prisma.CustodyInclude;
type Row = Prisma.CustodyGetPayload<{ include: typeof CUSTODY_INCLUDE }>;

// عُهد الموظف — في «خدماتي» يظهر نموذج الإقرار للعهدة الجديدة
export default function CustodyList({ custodies, employeeName, selfService, linkAssets }: {
  custodies: Row[];
  employeeName: string;
  selfService?: boolean;
  linkAssets?: boolean;
}) {
  const pending = selfService ? custodies.filter((c) => c.status === "PENDING") : [];
  return (
    <div className="space-y-4">
      {pending.map((c) => (
        <section key={c.id} className="card space-y-3 border-2 border-amber-300 p-5">
          <h2 className="font-semibold">عهدة جديدة بانتظار إقرارك: {c.asset.name}</h2>
          <p className="whitespace-pre-line rounded-lg bg-neutral-50 p-3 text-sm leading-relaxed">
            {custodyPledge({ employee: employeeName, asset: c.asset.name, number: assetNumber(c.asset.number), serial: c.asset.serialNumber, condition: c.conditionOut })}
          </p>
          <ActionForm action={acknowledgeCustody} submitLabel="أقرّ باستلام العهدة">
            <input type="hidden" name="id" value={c.id} />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="pledge" required className="mt-1 size-4 accent-brand-600" />
              قرأت الإقرار أعلاه وأوافق عليه، وتأكدت من استلام الأصل بالحالة المذكورة.
            </label>
          </ActionForm>
        </section>
      ))}
      <div className="card overflow-x-auto">
        <table className="table min-w-[620px]">
          <thead><tr><th>الأصل</th><th>تاريخ التسليم</th><th>تاريخ الإعادة</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            {custodies.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-neutral-500">لا توجد عُهد</td></tr>}
            {custodies.map((c) => (
              <tr key={c.id}>
                <td>
                  {linkAssets ? <Link href={`/admin-affairs/assets/${c.asset.id}`} className="link">{c.asset.name}</Link> : c.asset.name}
                  <div className="text-xs text-neutral-500 tabular-nums" dir="ltr">{[assetNumber(c.asset.number), c.asset.serialNumber].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="whitespace-nowrap">{formatDate(c.assignedAt)}</td>
                <td className="whitespace-nowrap">{formatDate(c.returnedAt)}</td>
                <td><Badge className={CUSTODY_STATUS_STYLES[c.status]}>{CUSTODY_STATUS_LABELS[c.status]}</Badge></td>
                <td><Link href={`/admin-affairs/assets/custody/${c.id}`} className="link flex items-center gap-1 whitespace-nowrap text-xs"><Printer size={14} aria-hidden="true" /> النموذج</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
