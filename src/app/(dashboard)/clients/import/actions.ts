"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { ExcelJS, cellText } from "@/lib/excel";
import { IMPORT_COLUMNS, type ImportKey, type ImportReport } from "@/lib/import-columns";

const STATUS: Record<string, "ACTIVE" | "LEAD" | "INACTIVE"> = { "نشط": "ACTIVE", "محتمل": "LEAD", "عميل محتمل": "LEAD", "متوقف": "INACTIVE" };
const MAX_ROWS = 2000;

export type ImportState = { error?: string; report?: ImportReport } | undefined;

export async function importClients(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireSection("clients");
  const mode = formData.get("mode") === "commit" ? "commit" : "check";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "يرجى اختيار ملف Excel" };
  if (file.size > 5 * 1024 * 1024) return { error: "حجم الملف يتجاوز 5 ميجابايت" };

  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer()); } catch { return { error: "الملف ليس ملف Excel (xlsx) صالحاً" }; }
  const ws = wb.worksheets[0];
  if (!ws) return { error: "الملف فارغ" };

  // نحدد الأعمدة من صف العناوين
  const colOf = new Map<ImportKey, number>();
  ws.getRow(1).eachCell((cell, col) => {
    const h = cellText(cell.value).replace(/[*\s]+$/, "").trim();
    const c = IMPORT_COLUMNS.find((x) => x.header === h);
    if (c) colOf.set(c.key, col);
  });
  if (!colOf.has("name")) return { error: `لم يُعثر على عمود "اسم العميل" في الصف الأول. يرجى استخدام القالب الجاهز` };

  type Row = Record<ImportKey, string> & { row: number };
  const rows: Row[] = [];
  ws.eachRow((r, i) => {
    if (i === 1) return;
    const o = { row: i } as Row;
    for (const c of IMPORT_COLUMNS) o[c.key] = colOf.has(c.key) ? cellText(r.getCell(colOf.get(c.key)!).value) : "";
    if (Object.values(o).some((v, k) => k > 0 && v)) rows.push(o);
  });
  if (rows.length === 0) return { error: "لا توجد بيانات في الملف" };
  if (rows.length > MAX_ROWS) return { error: `يحتوي الملف على أكثر من ${MAX_ROWS} صف. يرجى تقسيمه إلى عدة ملفات` };

  const report: ImportReport = { mode, rows: rows.length, newClients: 0, existingClients: 0, newCompanies: 0, errors: [], notes: [] };
  const err = (row: number, msg: string) => report.errors.push({ row, msg });

  // بيانات موجودة قبل كده
  const ids = rows.map((r) => r.nationalId).filter(Boolean);
  const crs = rows.map((r) => r.crNumber).filter(Boolean);
  const phones = rows.map((r) => r.phone.replace(/\s/g, "")).filter(Boolean);
  const [existingByIdList, existingByPhoneList, existingCrList, existingUnified] = await Promise.all([
    db.client.findMany({ where: { nationalId: { in: ids } }, select: { id: true, nationalId: true } }),
    db.client.findMany({ where: { phone: { in: phones } }, select: { id: true, name: true, phone: true } }),
    db.company.findMany({ where: { crNumber: { in: crs } }, select: { crNumber: true } }),
    db.company.findMany({ where: { unifiedNumber: { in: rows.map((r) => r.unifiedNumber).filter(Boolean) } }, select: { unifiedNumber: true } }),
  ]);
  const existingById = new Map(existingByIdList.map((c) => [c.nationalId!, c.id]));
  // عميل من غير رقم هوية: بنتعرف عليه بالاسم + الجوال
  const existingByNamePhone = new Map(existingByPhoneList.map((c) => [`${c.name.trim()}|${c.phone}`, c.id]));
  const existingCr = new Set(existingCrList.map((c) => c.crNumber));
  const existingUni = new Set(existingUnified.map((c) => c.unifiedNumber));

  type Plan = { key: string; existingId?: string; data: Record<string, unknown>; companies: Record<string, unknown>[] };
  const plans = new Map<string, Plan>();
  const seenCr = new Set<string>();

  for (const r of rows) {
    const before = report.errors.length;
    if (r.name.length < 2) err(r.row, "اسم العميل مفقود");
    if (r.nationalId && !/^[12]\d{9}$/.test(r.nationalId)) err(r.row, "يجب أن يتكون رقم الهوية من 10 أرقام ويبدأ بـ 1 أو 2");
    const phone = r.phone.replace(/\s/g, "");
    if (phone && !/^(05\d{8}|\+?\d{9,15})$/.test(phone)) err(r.row, "رقم الجوال غير صحيح");
    if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) err(r.row, "البريد الإلكتروني غير صحيح");
    if (r.status && !STATUS[r.status]) err(r.row, `يجب أن تكون الحالة: نشط أو محتمل أو متوقف`);
    if (r.crNumber && !/^\d{10}$/.test(r.crNumber)) err(r.row, "يجب أن يتكون السجل التجاري من 10 أرقام");
    if (r.unifiedNumber && !/^7\d{9}$/.test(r.unifiedNumber)) err(r.row, "يجب أن يتكون الرقم الموحد من 10 أرقام ويبدأ بـ 7");
    if (r.vatNumber && !/^3\d{13}3$/.test(r.vatNumber)) err(r.row, "يجب أن يتكون الرقم الضريبي من 15 رقماً ويبدأ وينتهي بـ 3");
    const expiry = r.crExpiry ? new Date(r.crExpiry) : null;
    if (expiry && isNaN(expiry.getTime())) err(r.row, "صيغة تاريخ انتهاء السجل غير صحيحة (الصيغة المطلوبة: 2027-03-15)");
    if ((r.crNumber || r.unifiedNumber || r.vatNumber || r.crExpiry) && !r.companyName) err(r.row, "توجد بيانات شركة دون اسم الشركة");
    if (report.errors.length > before) continue;

    // نفس العميل: برقم الهوية، أو بالاسم + الجوال
    const key = r.nationalId ? `id:${r.nationalId}` : `np:${r.name}|${phone}`;
    let plan = plans.get(key);
    if (!plan) {
      const existingId = r.nationalId ? existingById.get(r.nationalId) : phone ? existingByNamePhone.get(`${r.name}|${phone}`) : undefined;
      plan = {
        key, existingId, companies: [],
        data: {
          name: r.name, nationalId: r.nationalId || null, phone: phone || null, email: r.email || null,
          city: r.city || null, status: STATUS[r.status] ?? "ACTIVE", notes: r.notes || null,
        },
      };
      plans.set(key, plan);
      if (existingId) { report.existingClients++; report.notes.push({ row: r.row, msg: `العميل "${r.name}" مسجّل مسبقاً — ستُضاف شركاته الجديدة فقط` }); }
      else report.newClients++;
    }

    if (r.companyName) {
      if (r.crNumber && (existingCr.has(r.crNumber) || seenCr.has(r.crNumber))) {
        report.notes.push({ row: r.row, msg: `السجل ${r.crNumber} مسجّل مسبقاً — سيتم تخطي هذه الشركة` });
      } else if (r.unifiedNumber && existingUni.has(r.unifiedNumber)) {
        report.notes.push({ row: r.row, msg: `الرقم الموحد ${r.unifiedNumber} مسجّل مسبقاً — سيتم تخطي هذه الشركة` });
      } else {
        if (r.crNumber) seenCr.add(r.crNumber);
        plan.companies.push({
          name: r.companyName, crNumber: r.crNumber || null, crExpiry: expiry,
          unifiedNumber: r.unifiedNumber || null, vatNumber: r.vatNumber || null,
        });
        report.newCompanies++;
      }
    }
  }

  if (mode === "check" || report.errors.length > 0) return { report: { ...report, mode: "check" } };

  await db.$transaction(async (tx) => {
    for (const p of plans.values()) {
      if (p.existingId) {
        for (const co of p.companies) await tx.company.create({ data: { ...co, clientId: p.existingId } as never });
      } else {
        await tx.client.create({ data: { ...(p.data as object), accountManagerId: user.id, companies: { create: p.companies } } as never });
      }
    }
  }, { timeout: 60000 });
  revalidatePath("/clients/directory");
  revalidatePath("/clients/companies");
  return { report };
}
