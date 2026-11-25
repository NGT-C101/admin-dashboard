"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isManager, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_DOCS_PER_CONTRACT, MAX_DOCS_PER_OWNER } from "@/lib/documents";
import { type FormState, firstError, optionalDate, optionalText } from "@/lib/forms";
import { MAX_FILE_BYTES, deleteStoredFile, detectType, saveFile } from "@/lib/storage";

const schema = z.object({
  ownerType: z.enum(["client", "company", "contract"]),
  ownerId: z.string().min(1),
  type: z.enum(["CR", "NATIONAL_ID", "BALADY_LICENSE", "NATIONAL_ADDRESS", "ZAKAT_CERT", "VAT_CERT", "OTHER_LICENSE", "CONTRACT", "OTHER"], {
    message: "اختار نوع المستند",
  }),
  title: optionalText,
  expiresAt: optionalDate,
});

type OwnerType = "client" | "company" | "contract";
const ownerPath = (t: OwnerType, id: string) =>
  t === "client" ? `/clients/directory/${id}` : t === "company" ? `/clients/companies/${id}` : `/clients/contracts/${id}`;

export async function uploadDocument(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSection("clients");
  const { file: _f, ...fields } = Object.fromEntries(formData);
  const parsed = schema.safeParse(fields);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { ownerType, ownerId, ...data } = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "اختار الملف" };
  if (file.size > MAX_FILE_BYTES) return { error: "حجم الملف أكبر من 10 ميجا" };

  const where = ownerType === "client" ? { clientId: ownerId } : ownerType === "company" ? { companyId: ownerId } : { contractId: ownerId };
  const owner = ownerType === "client"
    ? await db.client.findUnique({ where: { id: ownerId } })
    : ownerType === "company"
      ? await db.company.findUnique({ where: { id: ownerId } })
      : await db.contract.findUnique({ where: { id: ownerId } });
  if (!owner) return { error: "مش موجود" };
  const max = ownerType === "contract" ? MAX_DOCS_PER_CONTRACT : MAX_DOCS_PER_OWNER;
  if ((await db.document.count({ where })) >= max) {
    return { error: `وصلت للحد الأقصى (${max} مستندات). احذف مستند قديم الأول` };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const kind = detectType(buf);
  if (!kind) return { error: "نوع الملف مش مدعوم. المسموح: PDF أو صورة (JPG / PNG / WEBP)" };

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
  const user = await requireSection("clients");
  const doc = await db.document.findUnique({ where: { id: String(formData.get("id")) } });
  if (!doc) return;
  // الحذف للمدير ومدير القسم، أو للي رفع المستند
  if (!isManager(user) && doc.uploadedById !== user.id) return;
  await db.document.delete({ where: { id: doc.id } });
  await deleteStoredFile(doc.storageKey);
  if (doc.clientId) revalidatePath(ownerPath("client", doc.clientId));
  if (doc.companyId) revalidatePath(ownerPath("company", doc.companyId));
  if (doc.contractId) revalidatePath(ownerPath("contract", doc.contractId));
}
