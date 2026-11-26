import type { DocType } from "@prisma/client";

export const MAX_DOCS_PER_OWNER = 10;
export const MAX_DOCS_PER_CONTRACT = 5;
export const MAX_DOCS_PER_TRANSACTION = 10;
export type DocOwnerType = "client" | "company" | "contract" | "employee" | "transaction" | "letter";
export function maxDocsFor(owner: DocOwnerType) {
  return owner === "contract" ? MAX_DOCS_PER_CONTRACT : owner === "transaction" ? MAX_DOCS_PER_TRANSACTION : MAX_DOCS_PER_OWNER;
}
// الأنواع المناسبة لكل نوع مالك
const EMPLOYEE_TYPES: DocType[] = ["NATIONAL_ID", "PASSPORT", "WORK_CONTRACT", "QUALIFICATION", "OTHER"];
const EMPLOYEE_ONLY: DocType[] = ["PASSPORT", "WORK_CONTRACT", "QUALIFICATION"];
// مخرجات المعاملة: ما تصدره الجهات الحكومية بعد الإنجاز
const TRANSACTION_TYPES: DocType[] = [
  "CR", "BALADY_LICENSE", "OTHER_LICENSE", "CERTIFICATE", "LETTER", "PAYMENT_RECEIPT",
  "NATIONAL_ADDRESS", "ZAKAT_CERT", "VAT_CERT", "CONTRACT", "OTHER",
];
const TRANSACTION_ONLY: DocType[] = ["CERTIFICATE", "LETTER", "PAYMENT_RECEIPT"];
export function docTypesFor(owner: DocOwnerType): DocType[] {
  if (owner === "employee") return EMPLOYEE_TYPES;
  if (owner === "transaction") return TRANSACTION_TYPES;
  if (owner === "letter") return ["LETTER", "CONTRACT", "CERTIFICATE", "OTHER"];
  return (Object.keys(DOC_TYPE_LABELS) as DocType[]).filter((t) => !EMPLOYEE_ONLY.includes(t) && !TRANSACTION_ONLY.includes(t));
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
  CERTIFICATE: "شهادة",
  LETTER: "خطاب / إفادة",
  PAYMENT_RECEIPT: "إيصال سداد",
};

// المستند تبع مين (عميل، شركة، عقد، موظف، معاملة)
export function documentOwner(doc: { clientId: string | null; companyId: string | null; contractId: string | null; employeeId: string | null; transactionId: string | null; letterId: string | null }) {
  if (doc.letterId) return { type: "letter" as const, id: doc.letterId };
  if (doc.transactionId) return { type: "transaction" as const, id: doc.transactionId };
  if (doc.employeeId) return { type: "employee" as const, id: doc.employeeId };
  if (doc.contractId) return { type: "contract" as const, id: doc.contractId };
  if (doc.companyId) return { type: "company" as const, id: doc.companyId };
  return { type: "client" as const, id: doc.clientId! };
}
