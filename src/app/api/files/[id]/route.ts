// فتح مستند حسب صلاحية القسم اللي المستند تبعه
import { can, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeTx } from "@/lib/transactions";
import { readStoredFile } from "@/lib/storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("غير مسموح", { status: 403 });
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id }, include: { transaction: { select: { confidential: true, assigneeId: true } } } });
  if (!doc) return new Response("غير موجود", { status: 404 });

  // مستند الموظف: لصاحب الإدارة الكاملة على الموظفين أو للموظف نفسه
  const allowed = doc.employeeId
    ? can(user, "employees", "MANAGE") || user.employeeId === doc.employeeId
    : doc.transaction ? can(user, "requests", "VIEW") && canSeeTx(user, doc.transaction)
    : doc.letterId ? can(user, "admin-affairs", "VIEW")
    : can(user, "clients", "VIEW");
  if (!allowed) return new Response("غير مسموح", { status: 403 });

  const data = await readStoredFile(doc.storageKey).catch(() => null);
  if (!data) return new Response("الملف غير موجود على الخادم", { status: 404 });

  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
