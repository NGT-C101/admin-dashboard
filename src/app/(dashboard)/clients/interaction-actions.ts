"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isManager, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalText } from "@/lib/forms";

const schema = z
  .object({
    clientId: z.string().min(1, "اختار العميل"),
    companyId: optionalText,
    type: z.enum(["CALL", "WHATSAPP", "MEETING", "VISIT", "EMAIL", "OTHER"]),
    occurredAt: optionalText.transform((v) => (v ? new Date(v) : new Date())),
    summary: z.string().trim().min(3, "اكتب ملخص التواصل"),
    followUpAt: optionalText.transform((v) => (v ? new Date(v) : null)),
    followUpNote: optionalText,
    assigneeId: optionalText,
  })
  .refine((d) => !d.followUpNote || d.followUpAt, { message: "حدد موعد المتابعة" });

function revalidateAll(clientId: string, companyId?: string | null) {
  revalidatePath(`/clients/directory/${clientId}`);
  if (companyId) revalidatePath(`/clients/companies/${companyId}`);
  revalidatePath("/clients/communications");
  revalidatePath("/clients/alerts");
  revalidatePath("/");
}

export async function createInteraction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSection("clients");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (d.companyId) {
    const co = await db.company.findUnique({ where: { id: d.companyId } });
    if (!co || co.clientId !== d.clientId) return { error: "الشركة مش تبع العميل ده" };
  }
  await db.interaction.create({
    data: { ...d, assigneeId: d.followUpAt ? d.assigneeId ?? user.id : null, createdById: user.id },
  });
  revalidateAll(d.clientId, d.companyId);
  return { success: "تم التسجيل ✅" };
}

export async function toggleFollowUp(formData: FormData) {
  await requireSection("clients");
  const it = await db.interaction.findUnique({ where: { id: String(formData.get("id")) } });
  if (!it) return;
  await db.interaction.update({ where: { id: it.id }, data: { followUpDone: !it.followUpDone } });
  revalidateAll(it.clientId, it.companyId);
}

export async function deleteInteraction(formData: FormData) {
  const user = await requireSection("clients");
  const it = await db.interaction.findUnique({ where: { id: String(formData.get("id")) } });
  if (!it || (!isManager(user) && it.createdById !== user.id)) return;
  await db.interaction.delete({ where: { id: it.id } });
  revalidateAll(it.clientId, it.companyId);
}
