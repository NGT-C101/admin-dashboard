// تصدير نتائج الأرشيف إلى Excel بنفس فلاتر الصفحة وصلاحياتها
import { ARCHIVE_INCLUDE, OWNER_LABELS, archiveWhere, ownerOf } from "@/lib/archive";
import { can, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DOC_TYPE_LABELS } from "@/lib/documents";
import { ExcelJS, addSheet, xlsxResponse } from "@/lib/excel";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "admin-affairs")) return new Response("غير مسموح", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const f = { q: sp.get("q") ?? undefined, type: sp.get("type") ?? undefined, owner: sp.get("owner") ?? undefined, expiry: sp.get("expiry") ?? undefined };
  const docs = await db.document.findMany({ where: archiveWhere(user, f), include: ARCHIVE_INCLUDE, orderBy: { createdAt: "desc" }, take: 5000 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "NGT";
  addSheet(wb, "الأرشيف", [
    { header: "نوع المستند", key: "type", width: 20 }, { header: "الوصف", key: "title", width: 28 },
    { header: "يتبع", key: "kind", width: 10 }, { header: "الاسم", key: "owner", width: 30 }, { header: "تفاصيل", key: "sub", width: 26 },
    { header: "اسم الملف", key: "fileName", width: 28 }, { header: "تاريخ الانتهاء", key: "expiresAt", date: true },
    { header: "رفعه", key: "uploadedBy", width: 18 }, { header: "تاريخ الرفع", key: "createdAt", date: true },
  ], docs.map((d) => {
    const o = ownerOf(d);
    return {
      type: DOC_TYPE_LABELS[d.type], title: d.title, kind: OWNER_LABELS[o.kind], owner: o.name, sub: o.sub,
      fileName: d.fileName, expiresAt: d.expiresAt, uploadedBy: d.uploadedBy.name, createdAt: d.createdAt,
    };
  }));
  return xlsxResponse(wb, `أرشيف-NGT-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
