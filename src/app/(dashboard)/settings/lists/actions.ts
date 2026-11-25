"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, uniqueError } from "@/lib/forms";

const schema = z.object({
  list: z.enum(["serviceType", "govEntity", "stage"]),
  id: z.string().optional(),
  name: z.string().trim().min(2, "الاسم قصير جداً"),
  order: z.coerce.number().int().min(0).default(0),
  active: z.string().optional().transform((v) => v !== "off"),
  kind: z.enum(["OPEN", "DONE", "CANCELLED"]).optional(),
});

export async function saveListItem(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { list, id, kind, ...data } = parsed.data;
  const full = list === "stage" ? { ...data, kind: kind ?? "OPEN" } : data;

  try {
    // Prisma محتاج نستخدم كل جدول باسمه
    const model = db[list] as unknown as {
      create(a: { data: object }): Promise<unknown>;
      update(a: { where: { id: string }; data: object }): Promise<unknown>;
    };
    if (id) await model.update({ where: { id }, data: full });
    else await model.create({ data: full });
  } catch (e) {
    return { error: uniqueError(e, { name: "الاسم" }) ?? "حصل خطأ" };
  }
  revalidatePath("/settings/lists");
  return { success: id ? "تم الحفظ" : "تمت الإضافة" };
}
