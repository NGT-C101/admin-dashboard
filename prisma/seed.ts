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
  await seedPositions();
  await markDeliveryStage();
  await acceptExistingTransactions();
  await seedLetterTemplates();
  await seedAssetCategories();
}

// مرة واحدة: تصنيفات الأصول الأساسية (قابلة للتعديل من الأصول والعُهد ← التصنيفات)
async function seedAssetCategories() {
  const KEY = "assets-v1";
  if (await prisma.appMeta.findUnique({ where: { key: KEY } })) return;
  const names = ["أجهزة حاسب", "جوالات وأجهزة لوحية", "طابعات ومعدات مكتبية", "أثاث", "سيارات", "أخرى"];
  for (const [order, name] of names.entries()) {
    await prisma.assetCategory.upsert({ where: { name }, update: {}, create: { name, order } });
  }
  await prisma.appMeta.create({ data: { key: KEY, value: new Date().toISOString() } });
  console.log("✔ تصنيفات الأصول");
}

// مرة واحدة: قوالب خطابات أساسية (قابلة للتعديل أو الإيقاف من صفحة الصادر والوارد)
async function seedLetterTemplates() {
  const KEY = "letters-v1";
  if (await prisma.appMeta.findUnique({ where: { key: KEY } })) return;
  const open = "السلام عليكم ورحمة الله وبركاته، وبعد:";
  const close = "وتقبلوا خالص التحية والتقدير،";
  const templates = [
    {
      name: "خطاب عام", subject: null,
      body: `${open}\n\n[نص الخطاب]\n\n${close}`,
    },
    {
      name: "خطاب تفويض مراجعة جهة حكومية", subject: "تفويض بالمراجعة",
      body: `${open}\n\nنفيدكم بأننا قد فوّضنا السيد/ [اسم المفوَّض] بموجب هوية رقم [رقم الهوية]، أحد منسوبي منشأتنا، بمراجعتكم لإنهاء إجراءات [نوع الإجراء] الخاصة بـ [اسم المنشأة العميلة] ذات السجل التجاري رقم [رقم السجل]، والتوقيع واستلام ما يلزم نيابةً عنا.\n\nآملين التكرم بتسهيل مهمته.\n\n${close}`,
    },
    {
      name: "خطاب تعريف بموظف", subject: "تعريف",
      body: `${open}\n\nتشهد [اسم المنشأة] بأن السيد/ [اسم الموظف]، [الجنسية]، بموجب هوية رقم [رقم الهوية]، يعمل لدينا بوظيفة [المسمى الوظيفي] منذ تاريخ [تاريخ الالتحاق] وحتى تاريخه، وقد أُعطي هذا الخطاب بناءً على طلبه دون أدنى مسؤولية على المنشأة.\n\n${close}`,
    },
  ];
  for (const [order, t] of templates.entries()) {
    await prisma.letterTemplate.upsert({ where: { name: t.name }, update: {}, create: { ...t, order } });
  }
  await prisma.appMeta.create({ data: { key: KEY, value: new Date().toISOString() } });
  console.log("✔ قوالب الخطابات");
}

// مرة واحدة عند تفعيل «الاستلام بتعهد»: المعاملات الموجودة قبله تُعدّ مستلَمة حتى لا يتوقف العمل عليها
async function acceptExistingTransactions() {
  const KEY = "tx-acceptance-v1";
  if (await prisma.appMeta.findUnique({ where: { key: KEY } })) return;
  const { count } = await prisma.transaction.updateMany({ where: { assigneeId: { not: null }, acceptedAt: null }, data: { acceptedAt: new Date() } });
  await prisma.appMeta.create({ data: { key: KEY, value: new Date().toISOString() } });
  console.log(`✔ اعتبار المعاملات الحالية مستلَمة (${count})`);
}

// مرة واحدة: مرحلة «صدرت / معتمدة» تعني أن المخرجات جاهزة للتسليم للعميل
// (قابلة للتغيير لاحقاً من الإعدادات ← القوائم والمراحل)
async function markDeliveryStage() {
  const KEY = "deliveries-v1";
  if (await prisma.appMeta.findUnique({ where: { key: KEY } })) return;
  const { count } = await prisma.stage.updateMany({ where: { name: "صدرت / معتمدة" }, data: { readyForDelivery: true } });
  await prisma.appMeta.create({ data: { key: KEY, value: new Date().toISOString() } });
  console.log(`✔ مرحلة الجاهزية للتسليم (${count})`);
}

// الهيكل القيادي الافتراضي لشركة استشارات إدارية (قابل للتعديل من المنصة)
async function seedPositions() {
  const KEY = "positions-v1";
  if (await prisma.appMeta.findUnique({ where: { key: KEY } })) return;
  type P = [string, "EXECUTIVE" | "SENIOR" | "DEPARTMENT", string, string | null];
  const tree: P[] = [
    ["المدير التنفيذي", "EXECUTIVE", "القيادة العليا ورسم الاستراتيجية وتمثيل الشركة", null],
    ["المدير العام", "EXECUTIVE", "إدارة العمليات اليومية وتنفيذ الخطط ومتابعة الأقسام", "المدير التنفيذي"],
    ["المدير الإداري", "SENIOR", "الموارد البشرية والشؤون الإدارية والخدمات المساندة", "المدير العام"],
    ["المدير المالي", "SENIOR", "الحسابات والميزانيات والتقارير المالية والزكاة والضريبة", "المدير العام"],
    ["مدير العمليات والمعاملات الحكومية", "SENIOR", "تنفيذ المعاملات ومتابعة المنصات الحكومية", "المدير العام"],
    ["مدير الموارد البشرية", "DEPARTMENT", "التوظيف وشؤون الموظفين والرواتب والتدريب", "المدير الإداري"],
    ["مدير الشؤون الإدارية", "DEPARTMENT", "المراسلات والأرشيف والأصول والمشتريات", "المدير الإداري"],
    ["مدير تقنية المعلومات", "DEPARTMENT", "الأنظمة والأجهزة وأمن المعلومات", "المدير الإداري"],
    ["مدير الحسابات", "DEPARTMENT", "القيود والفواتير والتحصيل والمصروفات", "المدير المالي"],
    ["مدير خدمة العملاء", "DEPARTMENT", "استقبال العملاء ومتابعة طلباتهم ورضاهم", "مدير العمليات والمعاملات الحكومية"],
    ["مدير المعاملات الحكومية", "DEPARTMENT", "إنجاز المعاملات لدى الجهات الحكومية", "مدير العمليات والمعاملات الحكومية"],
    ["مدير العلاقات العامة", "DEPARTMENT", "الشراكات والفعاليات وصورة الشركة", "المدير العام"],
    ["مدير التسويق والإعلام", "DEPARTMENT", "الحملات والمحتوى ووسائل التواصل", "المدير العام"],
  ];
  const ids = new Map<string, string>();
  for (const [order, [title, level, scope, parent]] of tree.entries()) {
    const existing = await prisma.position.findUnique({ where: { title } });
    const p = existing ?? await prisma.position.create({ data: { title, level, scope, order, parentId: parent ? ids.get(parent) ?? null : null } });
    ids.set(title, p.id);
  }
  await prisma.appMeta.create({ data: { key: KEY, value: new Date().toISOString() } });
  console.log("✔ المناصب القيادية");
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
