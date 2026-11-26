import DateField from "@/components/ui/DateField";
import type { Document } from "@prisma/client";
import { Download, Eye, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import ActionForm from "@/components/ui/ActionForm";
import { Field, FieldGrid } from "@/components/ui/Field";
import { deleteDocument, uploadDocument } from "@/app/(dashboard)/clients/document-actions";
import { DOC_TYPE_LABELS, type DocOwnerType, docTypesFor, maxDocsFor } from "@/lib/documents";
import { formatDate } from "@/lib/format";

type Doc = Document & { uploadedBy: { name: string } };

function sizeLabel(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} ميجا` : `${Math.ceil(n / 1024)} ك.ب`;
}

export function expiryState(d?: Date | null) {
  if (!d) return null;
  const days = (d.getTime() - Date.now()) / 86400000;
  return days < 0 ? "expired" : days <= 30 ? "soon" : "ok";
}

export default function DocumentsSection({ ownerType, ownerId, documents, userId, canUpload, canManage, title = "المستندات", deliveredIds }: {
  ownerType: DocOwnerType;
  ownerId: string;
  documents: Doc[];
  userId: string;
  canUpload: boolean;
  canManage: boolean; // حذف أي مستند
  title?: string;
  deliveredIds?: Set<string>; // مخرجات سُلِّمت للعميل: تظهر بشارة ولا تُحذف
}) {
  const max = maxDocsFor(ownerType);
  const full = documents.length >= max;
  const canDelete = (d: Doc) => !deliveredIds?.has(d.id) && (canManage || (ownerType !== "employee" && canUpload && d.uploadedById === userId));

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        {title} <span className="text-sm font-normal text-neutral-500">({documents.length} من {max})</span>
      </h2>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>النوع</th><th>الملف</th><th>تاريخ الانتهاء</th><th>رفعه</th><th></th></tr>
          </thead>
          <tbody>
            {documents.map((d) => {
              const st = expiryState(d.expiresAt);
              const Icon = d.mimeType === "application/pdf" ? FileText : ImageIcon;
              return (
                <tr key={d.id}>
                  <td>
                    <div className="font-medium">{DOC_TYPE_LABELS[d.type]}</div>
                    {d.title && <div className="text-xs text-neutral-500">{d.title}</div>}
                    {deliveredIds?.has(d.id) && <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 text-xs text-emerald-700 ring-1 ring-emerald-200">سُلِّم للعميل</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Icon size={16} className="text-brand-700 shrink-0" />
                      <span className="truncate max-w-52" dir="auto" title={d.fileName}>{d.fileName}</span>
                    </div>
                    <div className="text-xs text-neutral-500">{sizeLabel(d.size)}</div>
                  </td>
                  <td className={st === "expired" ? "text-rose-600 font-semibold" : st === "soon" ? "text-amber-600 font-semibold" : ""}>
                    {formatDate(d.expiresAt)}
                    {st === "expired" && <div className="text-xs">منتهٍ ⚠️</div>}
                    {st === "soon" && <div className="text-xs">ينتهي قريباً</div>}
                  </td>
                  <td className="text-xs text-neutral-600">{d.uploadedBy.name}<br />{formatDate(d.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-3 justify-end">
                      <a href={`/api/files/${d.id}`} target="_blank" rel="noopener" className="text-brand-700 hover:underline flex items-center gap-1 text-xs">
                        <Eye size={14} /> عرض
                      </a>
                      <a href={`/api/files/${d.id}?download`} className="text-neutral-600 hover:underline flex items-center gap-1 text-xs">
                        <Download size={14} /> تحميل
                      </a>
                      {canDelete(d) && (
                        <form action={deleteDocument}>
                          <input type="hidden" name="id" value={d.id} />
                          <button className="text-rose-600 hover:underline flex items-center gap-1 text-xs" title="حذف">
                            <Trash2 size={14} /> حذف
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {documents.length === 0 && (
              <tr><td colSpan={5} className="text-center text-neutral-500 py-8">لا توجد مستندات</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {!canUpload ? null : full ? (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
          تم بلوغ الحد الأقصى ({max} مستندات). يرجى حذف مستند قديم لرفع مستند جديد.
        </p>
      ) : (
        <details className="card">
          <summary className="cursor-pointer select-none p-4 font-semibold">{ownerType === "transaction" ? "+ رفع مخرج" : "+ رفع مستند"}</summary>
          <div className="border-t border-neutral-100 p-4">
            <ActionForm action={uploadDocument} submitLabel="رفع المستند">
              <input type="hidden" name="ownerType" value={ownerType} />
              <input type="hidden" name="ownerId" value={ownerId} />
              <FieldGrid>
                <Field label="نوع المستند *">
                  <select name="type" required defaultValue={ownerType === "contract" ? "CONTRACT" : ""} className="input">
                    <option value="" disabled>اختر النوع</option>
                    {docTypesFor(ownerType).map((v) => <option key={v} value={v}>{DOC_TYPE_LABELS[v]}</option>)}
                  </select>
                </Field>
                <Field label="وصف (اختياري)">
                  <input name="title" placeholder={ownerType === "transaction" ? "مثال: السجل التجاري بعد التعديل" : "مثال: رخصة الدفاع المدني"} className="input" />
                </Field>
                <Field label="تاريخ الانتهاء (اختياري)">
                  <DateField name="expiresAt" />
                </Field>
                <Field label="الملف * (PDF أو صورة، بحد أقصى 10 ميجابايت)" wide>
                  <input name="file" type="file" required accept=".pdf,image/jpeg,image/png,image/webp"
                    className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-brand-800 hover:file:bg-brand-100" />
                </Field>
              </FieldGrid>
            </ActionForm>
          </div>
        </details>
      )}
    </section>
  );
}
