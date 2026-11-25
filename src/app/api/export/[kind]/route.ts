// تصدير القوايم لـ Excel (لأصحاب صلاحية قسم العملاء)
import { canAccess, getCurrentUser } from "@/lib/auth";
import { CLIENT_STATUS_LABELS, CONTRACT_STATE_LABELS, CONTRACT_TYPE_LABELS, contractState, saudizationRate } from "@/lib/clients";
import { db } from "@/lib/db";
import { ExcelJS, addSheet, xlsxResponse } from "@/lib/excel";
import { IMPORT_COLUMNS } from "@/lib/import-columns";
import { findSection } from "@/lib/nav";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user, findSection("clients")!)) return new Response("غير مسموح", { status: 403 });
  const { kind } = await params;
  const wb = new ExcelJS.Workbook();
  wb.creator = "NGT";
  const today = new Date().toISOString().slice(0, 10);

  if (kind === "clients") {
    const clients = await db.client.findMany({
      where: { archivedAt: null }, orderBy: { name: "asc" },
      include: { accountManager: { select: { name: true } }, companies: { orderBy: { name: "asc" } } },
    });
    addSheet(wb, "العملاء", [
      { header: "اسم العميل", key: "name", width: 28 }, { header: "رقم الهوية", key: "nationalId" },
      { header: "الجوال", key: "phone" }, { header: "جوال آخر", key: "phone2" }, { header: "البريد", key: "email", width: 26 },
      { header: "المدينة", key: "city" }, { header: "الحالة", key: "status", width: 12 }, { header: "مميز", key: "vip", width: 8 },
      { header: "المصدر", key: "source" }, { header: "المسؤول", key: "manager" }, { header: "عدد الشركات", key: "companies", width: 12 },
      { header: "تاريخ التسجيل", key: "createdAt", date: true }, { header: "ملاحظات", key: "notes", width: 30 },
    ], clients.map((c) => ({
      name: c.name, nationalId: c.nationalId, phone: c.phone, phone2: c.phone2, email: c.email, city: c.city,
      status: CLIENT_STATUS_LABELS[c.status], vip: c.vip ? "⭐" : "", source: c.source, manager: c.accountManager?.name,
      companies: c.companies.length, createdAt: c.createdAt, notes: c.notes,
    })));
    addSheet(wb, "الشركات", [
      { header: "الشركة", key: "name", width: 30 }, { header: "المالك", key: "client", width: 26 },
      { header: "السجل التجاري", key: "crNumber" }, { header: "انتهاء السجل", key: "crExpiry", date: true },
      { header: "الرقم الموحد", key: "unifiedNumber" }, { header: "الرقم الضريبي", key: "vatNumber", width: 20 },
      { header: "العنوان الوطني", key: "nationalAddress" }, { header: "ملف مكتب العمل", key: "molFileNumber" },
      { header: "رقم التأمينات", key: "gosiNumber" }, { header: "الكيان القانوني", key: "legalForm", width: 22 },
      { header: "المدينة", key: "city" }, { header: "النشاط", key: "activity", width: 22 }, { header: "النطاق", key: "nitaqat" },
      { header: "سعوديين", key: "saudi", width: 10 }, { header: "غير سعوديين", key: "nonSaudi", width: 12 }, { header: "نسبة السعودة %", key: "rate", width: 14 },
    ], clients.flatMap((c) => c.companies.map((co) => ({
      ...co, client: c.name, saudi: co.saudiCount, nonSaudi: co.nonSaudiCount, rate: saudizationRate(co.saudiCount, co.nonSaudiCount),
    }))));
    return xlsxResponse(wb, `عملاء-NGT-${today}.xlsx`);
  }

  if (kind === "contracts") {
    const contracts = await db.contract.findMany({
      where: { client: { archivedAt: null } }, orderBy: { number: "asc" },
      include: { client: { select: { name: true } }, company: { select: { name: true } } },
    });
    addSheet(wb, "العقود", [
      { header: "رقم العقد", key: "number", width: 10 }, { header: "العنوان", key: "title", width: 34 },
      { header: "العميل", key: "client", width: 24 }, { header: "الشركة", key: "company", width: 24 },
      { header: "النوع", key: "type", width: 12 }, { header: "القيمة (ريال)", key: "value", money: true, width: 14 },
      { header: "البداية", key: "startDate", date: true }, { header: "النهاية", key: "endDate", date: true },
      { header: "تجديد تلقائي", key: "autoRenew", width: 12 }, { header: "الحالة", key: "state", width: 12 }, { header: "الشروط", key: "terms", width: 34 },
    ], contracts.map((c) => ({
      number: `C-${String(c.number).padStart(4, "0")}`, title: c.title, client: c.client.name, company: c.company?.name,
      type: CONTRACT_TYPE_LABELS[c.type], value: num(c.value), startDate: c.startDate, endDate: c.endDate,
      autoRenew: c.autoRenew ? "نعم" : "", state: CONTRACT_STATE_LABELS[contractState(c)], terms: c.terms,
    })));
    return xlsxResponse(wb, `عقود-NGT-${today}.xlsx`);
  }

  if (kind === "template") {
    const ws = addSheet(wb, "العملاء", IMPORT_COLUMNS.map((c) => ({ header: c.header + (("required" in c && c.required) ? " *" : ""), key: c.key, width: 22 })),
      [Object.fromEntries(IMPORT_COLUMNS.map((c) => [c.key, c.example]))]);
    ws.getRow(2).font = { color: { argb: "FF888888" }, italic: true };
    ws.getColumn("crExpiry").numFmt = "@";
    addSheet(wb, "تعليمات", [{ header: "تعليمات", key: "t", width: 90 }], [
      { t: "الصف الرمادي مثال توضيحي — احذفه أو اكتب فوقه." },
      { t: "اسم العميل إلزامي، وبقية الأعمدة اختيارية." },
      { t: "الحالة: نشط أو محتمل أو متوقف (إذا تُركت فارغة تُعتبر: نشط)." },
      { t: "صيغة التاريخ: 2027-03-15" },
      { t: "إذا كان للعميل أكثر من شركة: كرّر اسمه ورقم هويته في صف مستقل لكل شركة." },
      { t: "العميل المسجّل مسبقاً (برقم الهوية نفسه) لن يتكرر، وستُضاف شركاته الجديدة فقط." },
      { t: "سيتم تخطي الشركة التي سجلها التجاري مسجّل مسبقاً." },
    ]);
    return xlsxResponse(wb, "قالب-استيراد-العملاء.xlsx");
  }

  return new Response("غير موجود", { status: 404 });
}
