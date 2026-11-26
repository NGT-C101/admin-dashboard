// بيانات البداية: حساب المدير + القوائم الافتراضية
// آمن إنه يتشغّل أكتر من مرة: مش بيكرر ولا بيمسح تعديلاتك
import { PrismaClient, type StageKind } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATALOG, GENERAL_SERVICES, RETIRED_GENERAL } from "./catalog";

const prisma = new PrismaClient();

const STAGES: [string, StageKind][] = [
  ["جديد", "OPEN"],
  ["قيد الدراسة", "OPEN"],
  ["عرض سعر", "OPEN"],
  ["بانتظار موافقة العميل", "OPEN"],
  ["بانتظار مستندات العميل", "OPEN"],
  ["قيد تجهيز الملف", "OPEN"],
  ["تم الرفع على المنصة", "OPEN"],
  ["قيد المراجعة لدى الجهة", "OPEN"],
  ["ملاحظات من الجهة / مطلوب استكمال", "OPEN"],
  ["بانتظار سداد الرسوم", "OPEN"],
  ["صدرت / معتمدة", "OPEN"],
  ["مكتملة ومسلّمة", "DONE"],
  ["ملغاة / مرفوضة", "CANCELLED"],
];

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL ?? "admin@company.com";
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      console.log("⚠️ ADMIN_PASSWORD مش متحدد — مش هيتعمل حساب مدير");
      return;
    }
    password = "admin123"; // للتجربة على الجهاز بس
  }
  if (await prisma.user.findUnique({ where: { email } })) return;
  await prisma.user.create({
    data: { name: "مدير النظام", email, passwordHash: await bcrypt.hash(password, 10), role: "ADMIN" },
  });
  console.log(`✔ تم إنشاء حساب المدير: ${email}`);
}

async function main() {
  await seedAdmin();

  if ((await prisma.stage.count()) === 0) {
    await prisma.stage.createMany({ data: STAGES.map(([name, kind], order) => ({ name, kind, order })) });
    console.log("✔ مراحل المعاملات");
  }
  await syncCatalog();
  await migratePermissions();
  await seedHolidays();
}

// العطلات الرسمية الثابتة بالتاريخ الميلادي (الأعياد هجرية فبتتضاف من الإعدادات كل سنة)
async function seedHolidays() {
  const KEY = "holidays-v1";
  if (await prisma.appMeta.findUnique({ where: { key: KEY } })) return;
  const y = new Date().getFullYear();
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  for (const yr of [y, y + 1]) {
    await prisma.holiday.createMany({ data: [
      { name: "يوم التأسيس", startDate: d(`${yr}-02-22`), endDate: d(`${yr}-02-22`) },
      { name: "اليوم الوطني", startDate: d(`${yr}-09-23`), endDate: d(`${yr}-09-23`) },
    ] });
  }
  await prisma.appMeta.create({ data: { key: KEY, value: new Date().toISOString() } });
  console.log("✔ العطلات الرسمية الثابتة");
}

// تحويل المستخدمين القدام لنظام الصلاحيات الجديد (مرة واحدة):
// مدير القسم ← إدارة كاملة على قسمه، الموظف ← إضافة وتعديل
// وقسما العملاء والمعاملات كانوا مفتوحين لبعض، فبياخدوا "إضافة وتعديل" على التاني
async function migratePermissions() {
  const KEY = "permissions-v1";
  if (await prisma.appMeta.findUnique({ where: { key: KEY } })) return;
  const users = await prisma.user.findMany({ where: { role: { not: "ADMIN" }, department: { not: null } } });
  for (const u of users) {
    const perms = new Map<string, "VIEW" | "EDIT" | "MANAGE">();
    perms.set(u.department!, u.role === "MANAGER" ? "MANAGE" : "EDIT");
    if (u.department === "CLIENTS") perms.set("REQUESTS", perms.get("REQUESTS") ?? "EDIT");
    if (u.department === "REQUESTS") perms.set("CLIENTS", perms.get("CLIENTS") ?? "EDIT");
    for (const [section, level] of perms) {
      await prisma.permission.upsert({
        where: { userId_section: { userId: u.id, section: section as never } },
        update: {}, create: { userId: u.id, section: section as never, level },
      });
    }
  }
  await prisma.appMeta.create({ data: { key: KEY, value: new Date().toISOString() } });
  console.log(`✔ تحويل صلاحيات ${users.length} مستخدم للنظام الجديد`);
}

// تحميل كتالوج الخدمات مرة واحدة (آمن على سيرفر فيه بيانات):
// - بيضيف الجهات والخدمات الناقصة بس، ومش بيمسح أي حاجة
// - الخدمات العامة القديمة اللي اتستبدلت بتتوقف (مش بتتمسح) عشان المعاملات القديمة تفضل سليمة
const CATALOG_VERSION = "catalog-v1";

async function syncCatalog() {
  if (await prisma.appMeta.findUnique({ where: { key: CATALOG_VERSION } })) return;

  let entityOrder = (await prisma.govEntity.aggregate({ _max: { order: true } }))._max.order ?? -1;
  let added = 0;

  for (const [entityName, services] of CATALOG) {
    let entity = await prisma.govEntity.findUnique({ where: { name: entityName } });
    if (!entity) entity = await prisma.govEntity.create({ data: { name: entityName, order: ++entityOrder } });

    for (const [order, name] of services.entries()) {
      const exists = await prisma.serviceType.findFirst({ where: { name, govEntityId: entity.id } });
      if (!exists) {
        await prisma.serviceType.create({ data: { name, order, govEntityId: entity.id } });
        added++;
      }
    }
  }

  for (const [order, name] of GENERAL_SERVICES.entries()) {
    const exists = await prisma.serviceType.findFirst({ where: { name, govEntityId: null } });
    if (exists) await prisma.serviceType.update({ where: { id: exists.id }, data: { order, active: true } });
    else { await prisma.serviceType.create({ data: { name, order } }); added++; }
  }

  const retired = await prisma.serviceType.updateMany({
    where: { govEntityId: null, name: { in: RETIRED_GENERAL } },
    data: { active: false },
  });

  // الجهة "أخرى" تفضل في الآخر
  const other = await prisma.govEntity.findUnique({ where: { name: "أخرى" } });
  if (other) await prisma.govEntity.update({ where: { id: other.id }, data: { order: 999 } });

  await prisma.appMeta.create({ data: { key: CATALOG_VERSION, value: new Date().toISOString() } });
  console.log(`✔ كتالوج الخدمات: ${added} خدمة جديدة، ${retired.count} خدمة عامة قديمة اتوقفت`);
}

main().finally(() => prisma.$disconnect());
