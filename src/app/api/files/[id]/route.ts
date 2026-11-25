// فتح مستند: للمستخدمين اللي ليهم صلاحية على قسم العملاء بس
import { canAccess, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findSection } from "@/lib/nav";
import { readStoredFile } from "@/lib/storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user, findSection("clients")!)) return new Response("غير مسموح", { status: 403 });

  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return new Response("مش موجود", { status: 404 });

  const data = await readStoredFile(doc.storageKey).catch(() => null);
  if (!data) return new Response("الملف مش موجود على السيرفر", { status: 404 });

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
