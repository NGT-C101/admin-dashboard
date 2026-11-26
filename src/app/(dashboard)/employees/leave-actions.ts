"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { type FormState, firstError, optionalText } from "@/lib/forms";
import { annualBalance, canDecide, holidaySet, workingDays } from "@/lib/leave";
import { hmToMinutes, parseDateKey } from "@/lib/time";
import { daysText } from "@/lib/clients";

const LEAVE_TYPES = ["ANNUAL", "SICK", "UNPAID", "MARRIAGE", "BEREAVEMENT", "PATERNITY", "MATERNITY", "HAJJ", "EXAM", "OTHER"] as const;
const dateStr = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg).transform(parseDateKey);

const leaveSchema = z.object({
  type: z.enum(LEAVE_TYPES, { message: "يرجى اختيار نوع الإجازة" }),
  startDate: dateStr("يرجى تحديد تاريخ البداية"),
  endDate: dateStr("يرجى تحديد تاريخ النهاية"),
  reason: optionalText,
}).refine((d) => d.endDate >= d.startDate, { message: "يجب ألا يسبق تاريخ النهاية تاريخ البداية" });

const permissionSchema = z.object({
  date: dateStr("يرجى تحديد التاريخ"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "يرجى تحديد وقت البداية"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "يرجى تحديد وقت النهاية"),
  reason: optionalText,
}).refine((d) => hmToMinutes(d.endTime) > hmToMinutes(d.startTime), { message: "يجب أن يكون وقت النهاية بعد وقت البداية" });

function revalidateAll(employeeId: string) {
  revalidatePath("/me");
  revalidatePath("/employees/leaves");
  revalidatePath("/employees/attendance");
  revalidatePath(`/employees/profiles/${employeeId}`);
  revalidatePath("/");
}

// تقديم طلب: من الموظف نفسه، أو نيابةً عنه (لمن لديه صلاحية التعديل على الموظفين)
export async function submitRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const onBehalf = String(formData.get("employeeId") ?? "");
  if (onBehalf && !can(user, "employees", "EDIT")) return { error: "ليست لديك صلاحية تقديم طلب نيابةً عن موظف" };
  const employeeId = onBehalf || user.employeeId;
  if (!employeeId) return { error: "لا يوجد ملف موظف مرتبط بحسابك" };
  const emp = await db.employee.findUnique({ where: { id: employeeId } });
  if (!emp || emp.status === "TERMINATED") return { error: "الموظف غير موجود أو انتهت خدمته" };

  const raw = Object.fromEntries(formData);
  if (formData.get("kind") === "PERMISSION") {
    const p = permissionSchema.safeParse(raw);
    if (!p.success) return { error: firstError(p.error) };
    await db.leaveRequest.create({
      data: {
        employeeId, kind: "PERMISSION", startDate: p.data.date, endDate: p.data.date, startTime: p.data.startTime, endTime: p.data.endTime,
        minutes: hmToMinutes(p.data.endTime) - hmToMinutes(p.data.startTime), reason: p.data.reason, createdById: user.id,
      },
    });
    revalidateAll(employeeId);
    return { success: "تم تقديم طلب الاستئذان ✅" };
  }

  const l = leaveSchema.safeParse(raw);
  if (!l.success) return { error: firstError(l.error) };
  const days = workingDays(l.data.startDate, l.data.endDate, await holidaySet(l.data.startDate, l.data.endDate));
  if (days === 0) return { error: "الفترة المختارة لا تتضمن أيام عمل (عطلة أسبوعية أو رسمية)" };

  const overlap = await db.leaveRequest.findFirst({
    where: { employeeId, kind: "LEAVE", status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: l.data.endDate }, endDate: { gte: l.data.startDate } },
  });
  if (overlap) return { error: "يوجد طلب إجازة آخر يتداخل مع هذه الفترة" };

  if (l.data.type === "ANNUAL") {
    const b = await annualBalance(emp);
    const available = b.remaining - b.pending;
    if (days > available) return { error: `الأيام المطلوبة (${daysText(days)}) تتجاوز الرصيد المتاح (${daysText(available)})` };
  }
  await db.leaveRequest.create({ data: { employeeId, kind: "LEAVE", ...l.data, days, createdById: user.id } });
  revalidateAll(employeeId);
  return { success: `تم تقديم طلب الإجازة (${daysText(days)} عمل) ✅` };
}

export async function cancelRequest(formData: FormData) {
  const user = await requireUser();
  const req = await db.leaveRequest.findUnique({ where: { id: String(formData.get("id")) } });
  if (!req) return;
  const own = req.employeeId === user.employeeId && req.status === "PENDING";
  const admin = can(user, "employees", "MANAGE") && (req.status === "PENDING" || req.status === "APPROVED");
  if (!own && !admin) return;
  await db.leaveRequest.update({ where: { id: req.id }, data: { status: "CANCELLED" } });
  revalidateAll(req.employeeId);
}

export async function decideRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const req = await db.leaveRequest.findUnique({
    where: { id: String(formData.get("id")) },
    include: { employee: { include: { manager: { select: { userId: true } } } } },
  });
  if (!req || req.status !== "PENDING") return { error: "الطلب غير متاح للقرار" };
  if (!canDecide(user, req)) return { error: "ليست لديك صلاحية البت في هذا الطلب" };
  const approve = formData.get("decision") === "approve";
  if (approve && req.kind === "LEAVE" && req.type === "ANNUAL") {
    const b = await annualBalance(req.employee);
    if (req.days > b.remaining) return { error: `لا يكفي الرصيد: المتبقي ${daysText(b.remaining)}` };
  }
  await db.leaveRequest.update({
    where: { id: req.id },
    data: { status: approve ? "APPROVED" : "REJECTED", decidedById: user.id, decidedAt: new Date(), decisionNote: String(formData.get("note") ?? "").trim() || null },
  });
  revalidateAll(req.employeeId);
  return { success: approve ? "تم اعتماد الطلب ✅" : "تم رفض الطلب" };
}

export async function updateCarryover(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "employees", "MANAGE")) return { error: "ليست لديك الصلاحية" };
  const id = String(formData.get("id"));
  const n = Number(formData.get("leaveCarryover"));
  if (!Number.isInteger(n) || n < 0 || n > 365) return { error: "يرجى إدخال عدد أيام صحيح" };
  await db.employee.update({ where: { id }, data: { leaveCarryover: n } });
  revalidateAll(id);
  return { success: "تم حفظ الرصيد المرحّل" };
}
