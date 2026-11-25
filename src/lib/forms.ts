// أدوات مشتركة للتحقق من بيانات الفورم
import { z } from "zod";

export type FormState = { error?: string; success?: string } | undefined;

// نص اختياري: الفاضي يتحول لـ null
export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

// رقم من 10 خانات (هوية، سجل تجاري، رقم موحد)
export const tenDigits = (label: string, startsWith?: string) =>
  optionalText.refine(
    (v) => v === null || (/^\d{10}$/.test(v) && (!startsWith || startsWith.includes(v[0]))),
    { message: `${label} لازم يكون 10 أرقام${startsWith ? ` ويبدأ بـ ${startsWith.split("").join(" أو ")}` : ""}` },
  );

export const optionalMoney = optionalText.refine((v) => v === null || /^\d+(\.\d{1,2})?$/.test(v), {
  message: "المبلغ لازم يكون رقم (مثال: 1500 أو 1500.50)",
});

export const optionalInt = optionalText.refine((v) => v === null || /^\d{1,6}$/.test(v), {
  message: "اكتب رقم صحيح",
}).transform((v) => (v === null ? null : Number(v)));

export const optionalDate = optionalText.transform((v) => (v ? new Date(v) : null));

export function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "البيانات غير صحيحة";
}

// تحويل خطأ التكرار من قاعدة البيانات لرسالة مفهومة
export function uniqueError(e: unknown, labels: Record<string, string>): string | null {
  if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
    const target = String((e as { meta?: { target?: unknown } }).meta?.target ?? "");
    const field = Object.keys(labels).find((k) => target.includes(k));
    return field ? `${labels[field]} مسجّل قبل كده` : "البيانات دي مسجّلة قبل كده";
  }
  return null;
}
