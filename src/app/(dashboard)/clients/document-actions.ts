"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { documentOwner, maxDocsFor } from "@/lib/documents";
import { type FormState, firstError, optionalDate, optionalText } from "@/lib/forms";
import { canSeeTx } from "@/lib/transactions";
import { MAX_FILE_BYTES, deleteStoredFile, detectType, saveFile } from "@/lib/storage";

const OWNER_TYPES = ["client", "company", "contract", "employee", "transaction"] as const;
type OwnerType = (typeof OWNER_TYPES)[number];

const schema = z.object({
  ownerType: z.enum(OWNER_TYPES),
  ownerId: z.string().min(1),
  type: z.enum(
    ["CR", "NATIONAL_ID", "BALADY_LICENSE", "NATIONAL_ADDRESS", "ZAKAT_CERT", "VAT_CERT", "OTHER_LICENSE",
     "CONTRACT", "PASSPORT", "WORK_CONTRACT", "QUALIFICATION", "OTHER", "CERTIFICATE", "LETTER", "PAYMENT_RECEIPT"],
    { message: "يرجى اختيار نوع المستند" },
  ),
  title: optionalText,
  expiresAt: optionalDate,
});

const ownerPath = (t: OwnerType, id: string) =>
  t === "client" ? `/clients/directory/${id}`
  : t === "company" ? `/clients/companies/${id}`
  : t === "contract" ? `/clients/contracts/${id}`
  : t === "transaction" ? `/requests/all/${id}`
  : `/employees/profiles/${id}`;

// مستندات الموظفين حساسة: محتاجة "إدارة كاملة" على قسم الموظفين
// مخرجات المعاملات تتبع قسم المعاملات
const sectionOf = (t: OwnerType) => (t === "employee" ? "employees" : t === "transaction" ? "requests" : "clients");
const levelFor = (t: OwnerType, action: "upload" | "delete") =>
  t === "employee" ? "MANAGE" : action === "upload" ? "EDIT" : "MANAGE";

export async function uploadDocument(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { file: _f, ...fields } = Object.fromEntries(formData);
  const parsed = schema.safeParse(fields);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { ownerType, ownerId, ...data } = parsed.data;
  if (!can(user, sectionOf(ownerType), levelFor(ownerType, "upload"))) return { error: "ليست لديك صلاحية رفع المستندات" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "يرجى اختيار الملف" };
  if (file.size > MAX_FILE_BYTES) return { error: "حجم الملف يتجاوز 10 ميجابايت" };

  const where = { [`${ownerType}Id`]: ownerId } as Record<string, string>;
  const owner = ownerType === "client" ? await db.client.findUnique({ where: { id: ownerId } })
    : ownerType === "company" ? await db.company.findUnique({ where: { id: ownerId } })
    : ownerType === "contract" ? await db.contract.findUnique({ where: { id: ownerId } })
    : ownerType === "transaction" ? await db.transaction.findUnique({ where: { id: ownerId } })
    : await db.employee.findUnique({ where: { id: ownerId } });
  if (!owner || ("confidential" in owner && !canSeeTx(user, owner))) return { error: "غير موجود" };
  const max = maxDocsFor(ownerType);
  if ((await db.document.count({ where })) >= max) {
    return { error: `تم بلوغ الحد الأقصى (${max} مستندات). يرجى حذف مستند قديم أولاً` };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const kind = detectType(buf);
  if (!kind) return { error: "نوع الملف غير مدعوم. الأنواع المسموح بها: PDF أو صورة (JPG / PNG / WEBP)" };

  const storageKey = await saveFile(buf, kind.ext);
  await db.document.create({
    data: {
      ...where, ...data,
      fileName: file.name.slice(0, 200) || `document.${kind.ext}`,
      mimeType: kind.mime, size: buf.length, storageKey, uploadedById: user.id,
    },
  });
  revalidatePath(ownerPath(ownerType, ownerId));
  return { success: "تم رفع المستند ✅" };
}

export async function deleteDocument(formData: FormData) {
  const user = await requireUser();
  const doc = await db.document.findUnique({
    where: { id: String(formData.get("id")) },
    include: { _count: { select: { deliveries: true } } },
  });
  if (!doc) return;
  // مستند سُلِّم للعميل يبقى محفوظاً لأنه جزء من سجل التسليم
  if (doc._count.deliveries > 0) return;
  const owner = documentOwner(doc);
  // الحذف لصاحب صلاحية الإدارة الكاملة، أو لمن رفع المستند (في قسم العملاء)
  const allowed = can(user, sectionOf(owner.type), levelFor(owner.type, "delete"))
    || (owner.type !== "employee" && doc.uploadedById === user.id && can(user, sectionOf(owner.type), "EDIT"));
  if (!allowed) return;
  await db.document.delete({ where: { id: doc.id } });
  await deleteStoredFile(doc.storageKey);
  revalidatePath(ownerPath(owner.type, owner.id));
}
