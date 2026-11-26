import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Check, X } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import Badge from "@/components/ui/Badge";
import { cancelRequest, decideRequest } from "@/app/(dashboard)/employees/leave-actions";
import { can, type CurrentUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { LEAVE_TYPE_LABELS, REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES, canDecide, leaveNo } from "@/lib/leave";
import { minutesText } from "@/lib/time";

export const REQUEST_INCLUDE = {
  employee: { select: { id: true, fullName: true, manager: { select: { userId: true } } } },
  decidedBy: { select: { name: true } },
} satisfies Prisma.LeaveRequestInclude;
export type RequestRow = Prisma.LeaveRequestGetPayload<{ include: typeof REQUEST_INCLUDE }>;

export default function RequestsTable({ rows, user, showEmployee = true }: { rows: RequestRow[]; user: CurrentUser; showEmployee?: boolean }) {
  if (rows.length === 0) return <div className="card p-8 text-center text-neutral-500">لا توجد طلبات</div>;
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const decidable = r.status === "PENDING" && canDecide(user, r);
        const cancellable = (r.employeeId === user.employeeId && r.status === "PENDING")
          || (can(user, "employees", "MANAGE") && (r.status === "PENDING" || r.status === "APPROVED"));
        return (
          <div key={r.id} className="card p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-60 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-neutral-400" dir="ltr">{leaveNo(r.number)}</span>
                  <span className="font-semibold">{r.kind === "PERMISSION" ? "استئذان" : r.type ? LEAVE_TYPE_LABELS[r.type] : "إجازة"}</span>
                  <Badge className={REQUEST_STATUS_STYLES[r.status]}>{REQUEST_STATUS_LABELS[r.status]}</Badge>
                  {showEmployee && <Link href={`/employees/profiles/${r.employee.id}`} className="text-sm link">{r.employee.fullName}</Link>}
                </div>
                <div className="text-sm text-neutral-700">
                  {r.kind === "PERMISSION"
                    ? <>{formatDate(r.startDate)} · من {r.startTime} إلى {r.endTime} ({minutesText(r.minutes ?? 0)})</>
                    : <>{formatDate(r.startDate)} ← {formatDate(r.endDate)} · <b>{r.days}</b> يوم عمل</>}
                </div>
                {r.reason && <p className="text-sm text-neutral-600">{r.reason}</p>}
                {r.decidedBy && (
                  <p className="text-xs text-neutral-500">
                    {r.status === "APPROVED" ? "اعتمده" : "رفضه"} {r.decidedBy.name} · {formatDateTime(r.decidedAt!)}{r.decisionNote && ` — ${r.decisionNote}`}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {decidable && (
                  <ActionForm action={decideRequest} submitLabel="حفظ القرار" className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <label className="flex items-center gap-1 text-sm"><input type="radio" name="decision" value="approve" defaultChecked className="accent-emerald-600" /><Check size={14} className="text-emerald-600" /> اعتماد</label>
                    <label className="flex items-center gap-1 text-sm"><input type="radio" name="decision" value="reject" className="accent-rose-600" /><X size={14} className="text-rose-600" /> رفض</label>
                    <input name="note" placeholder="ملاحظة (اختياري)" className="input w-44 !py-1.5" />
                  </ActionForm>
                )}
                {cancellable && (
                  <form action={cancelRequest}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-xs text-rose-600 hover:underline">إلغاء الطلب</button>
                  </form>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
