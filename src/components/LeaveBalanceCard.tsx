import { annualBalance } from "@/lib/leave";

export default async function LeaveBalanceCard({ employee }: { employee: { id: string; hireDate: Date; leaveCarryover: number } }) {
  const b = await annualBalance(employee);
  const items: [string, number | string][] = [
    ["الاستحقاق السنوي", `${b.entitlement} يوماً`], ["المستحق لهذا العام", b.accrued], ["المرحّل", b.carryover],
    ["المستخدم", b.used], ["بانتظار الموافقة", b.pending],
  ];
  return (
    <div className="card p-5">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold">رصيد الإجازة السنوية {b.year}</h3>
          <p className="text-xs text-neutral-500">21 يوماً، و30 يوماً بعد إتمام 5 سنوات خدمة</p>
        </div>
        <div className="text-left">
          <div className="text-3xl font-bold text-brand-800">{b.remaining}</div>
          <div className="text-xs text-neutral-500">يوم متبقٍ</div>
        </div>
      </div>
      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden mb-4">
        <div className="h-full bg-brand-600" style={{ width: `${b.total ? Math.min(100, (b.used / b.total) * 100) : 0}%` }} />
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        {items.map(([l, v]) => <div key={l} className="rounded-lg bg-neutral-50 p-2"><dd className="font-bold">{v}</dd><dt className="text-[11px] text-neutral-500">{l}</dt></div>)}
      </dl>
    </div>
  );
}
