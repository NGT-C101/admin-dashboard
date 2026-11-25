import type { DocType } from "@prisma/client";

export const MAX_DOCS_PER_OWNER = 10;
export const MAX_DOCS_PER_CONTRACT = 5;
// الأنواع المناسبة لكل نوع مالك
const EMPLOYEE_TYPES: DocType[] = ["NATIONAL_ID", "PASSPORT", "WORK_CONTRACT", "QUALIFICATION", "OTHER"];
const EMPLOYEE_ONLY: DocType[] = ["PASSPORT", "WORK_CONTRACT", "QUALIFICATION"];
export function docTypesFor(owner: "client" | "company" | "contract" | "employee"): DocType[] {
  if (owner === "employee") return EMPLOYEE_TYPES;
  return (Object.keys(DOC_TYPE_LABELS) as DocType[]).filter((t) => !EMPLOYEE_ONLY.includes(t));
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  CR: "سجل تجاري",
  NATIONAL_ID: "هوية / إقامة",
  BALADY_LICENSE: "رخصة بلدي",
  NATIONAL_ADDRESS: "العنوان الوطني",
  ZAKAT_CERT: "شهادة الزكاة",
  VAT_CERT: "شهادة الضريبة",
  OTHER_LICENSE: "رخصة أخرى",
  CONTRACT: "عقد موقّع",
  PASSPORT: "جواز السفر",
  WORK_CONTRACT: "عقد العمل",
  QUALIFICATION: "مؤهل علمي / شهادة",
  OTHER: "مستند آخر",
};

// المستند تبع مين (عميل، شركة، عقد، موظف)
export function documentOwner(doc: { clientId: string | null; companyId: string | null; contractId: string | null; employeeId: string | null }) {
  if (doc.employeeId) return { type: "employee" as const, id: doc.employeeId };
  if (doc.contractId) return { type: "contract" as const, id: doc.contractId };
  if (doc.companyId) return { type: "company" as const, id: doc.companyId };
  return { type: "client" as const, id: doc.clientId! };
}
