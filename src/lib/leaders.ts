import "server-only";
import { db } from "./db";

// المناصب القيادية بترتيب الهيكل (التنفيذية ثم العليا ثم الأقسام)
export async function loadLeaders() {
  const ps = await db.position.findMany({
    orderBy: [{ level: "asc" }, { order: "asc" }],
    select: { title: true, holder: { select: { id: true, fullName: true, status: true } } },
  });
  return ps.map((p) => ({ title: p.title, holder: p.holder && p.holder.status !== "TERMINATED" ? { id: p.holder.id, fullName: p.holder.fullName } : null }));
}
