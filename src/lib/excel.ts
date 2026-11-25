import "server-only";
import ExcelJS from "exceljs";

export type Col = { header: string; key: string; width?: number; date?: boolean; money?: boolean };

// ورقة Excel من اليمين للشمال بعناوين بلون الهوية
export function addSheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({
    header: c.header, key: c.key, width: c.width ?? 18,
    style: c.date ? { numFmt: "yyyy-mm-dd" } : c.money ? { numFmt: "#,##0.00" } : {},
  }));
  rows.forEach((r) => ws.addRow(r));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7D0000" } };
  head.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  head.height = 24;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

export async function xlsxResponse(wb: ExcelJS.Workbook, fileName: string) {
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

// قراءة خلية: نص أو تاريخ أو رقم → نص نضيف
export function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text.trim();
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("").trim();
  }
  return String(v).trim();
}

export { ExcelJS };
