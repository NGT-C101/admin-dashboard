import type { DocType } from "@prisma/client";

export const MAX_DOCS_PER_OWNER = 10;
export const MAX_DOCS_PER_CONTRACT = 5;

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  CR: "سجل تجاري",
  NATIONAL_ID: "هوية / إقامة",
  BALADY_LICENSE: "رخصة بلدي",
  NATIONAL_ADDRESS: "العنوان الوطني",
  ZAKAT_CERT: "شهادة الزكاة",
  VAT_CERT: "شهادة الضريبة",
  OTHER_LICENSE: "رخصة أخرى",
  CONTRACT: "عقد موقّع",
  OTHER: "مستند آخر",
};
