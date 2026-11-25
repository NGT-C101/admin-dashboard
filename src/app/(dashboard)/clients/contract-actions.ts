"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isManager, requireSection } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalMoney, optionalText } from "@/lib/forms";

const schema = z
  .object({
    clientId: z.string().min(1, "اختار العميل"),
    companyId: optionalText,
    title: z.string().trim().min(3, "اكتب عنوان العقد"),
    type: z.enum(["ONE_TIME", "MONTHLY", "ANNUAL"]),
    value: optionalMoney,
    startDate: z.string().min(1, "حدد تاريخ البداية").transform((v) => new Date(v)),
    endDate: optionalText.transform((v) => (v ? new Date(v) : null)),
    autoRenew: z.string().optional().transform((v) => v === "on"),
    terms: optionalText,
  })
  .refine((d) => !d.endDate || d.endDate > d.startDate, { message: "تاريخ النهاية لازم يكون بعد البداية" });

async function check(d: z.infer<typeof schema>) {
  if (!d.companyId) return null;
  const co = await db.company.findUnique({ where: { id: d.companyId } });
  return !co || co.clientId !== d.clientId ? "الشركة مش تبع العميل ده" : null;
}

function revalidateAll(id: string, clientId: string, companyId?: string | null) {
  revalidatePath(`/clients/contracts/${id}`);
  revalidatePath("/clients/contracts");
  revalidatePath(`/clients/directory/${clientId}`);
  if (companyId) revalidatePath(`/clients/companies/${companyId}`);
  revalidatePath("/clients/alerts");
}

export async function createContract(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSection("clients");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const err = await check(parsed.data);
  if (err) return { error: err };
  const c = await db.contract.create({ data: { ...parsed.data, createdById: user.id } });
  redirect(`/clients/contracts/${c.id}`);
}

export async function updateContract(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSection("clients");
  const id = String(formData.get("id"));
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const err = await check(parsed.data);
  if (err) return { error: err };
  await db.contract.update({ where: { id }, data: parsed.data });
  revalidateAll(id, parsed.data.clientId, parsed.data.companyId);
  return { success: "تم حفظ التعديلات" };
}

// تجديد: بيمد تاريخ النهاية مدة جديدة (شهر للباقة الشهرية، سنة للسنوي)
export async function renewContract(formData: FormData) {
  const user = await requireSection("clients");
  if (!isManager(user)) return;
  const c = await db.contract.findUnique({ where: { id: String(formData.get("id")) } });
  if (!c || !c.endDate || c.cancelledAt) return;
  const end = new Date(c.endDate);
  if (c.type === "MONTHLY") end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  await db.contract.update({ where: { id: c.id }, data: { endDate: end } });
  revalidateAll(c.id, c.clientId, c.companyId);
}

export async function toggleCancelContract(formData: FormData) {
  const user = await requireSection("clients");
  if (!isManager(user)) return;
  const c = await db.contract.findUnique({ where: { id: String(formData.get("id")) } });
  if (!c) return;
  await db.contract.update({ where: { id: c.id }, data: { cancelledAt: c.cancelledAt ? null : new Date() } });
  revalidateAll(c.id, c.clientId, c.companyId);
}
