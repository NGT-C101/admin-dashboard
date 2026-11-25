// أعمدة ملف استيراد العملاء (الترتيب مش مهم، المهم اسم العمود)
export const IMPORT_COLUMNS = [
  { key: "name", header: "اسم العميل", required: true, example: "عبدالله محمد العتيبي" },
  { key: "nationalId", header: "رقم الهوية", example: "1012345678" },
  { key: "phone", header: "الجوال", example: "0551234567" },
  { key: "email", header: "البريد", example: "" },
  { key: "city", header: "المدينة", example: "الرياض" },
  { key: "status", header: "الحالة", example: "نشط" },
  { key: "companyName", header: "اسم الشركة", example: "مصنع الرياض للبلاستيك" },
  { key: "crNumber", header: "السجل التجاري", example: "1010123456" },
  { key: "crExpiry", header: "انتهاء السجل", example: "2027-03-15" },
  { key: "unifiedNumber", header: "الرقم الموحد", example: "7001234567" },
  { key: "vatNumber", header: "الرقم الضريبي", example: "" },
  { key: "notes", header: "ملاحظات", example: "" },
] as const;
export type ImportKey = (typeof IMPORT_COLUMNS)[number]["key"];

export type ImportReport = {
  mode: "check" | "commit";
  rows: number;
  newClients: number;
  existingClients: number;
  newCompanies: number;
  errors: { row: number; msg: string }[];
  notes: { row: number; msg: string }[];
};
