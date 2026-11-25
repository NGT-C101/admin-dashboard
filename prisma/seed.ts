// بيانات البداية: حساب المدير + القوائم الافتراضية
// آمن إنه يتشغّل أكتر من مرة: مش بيكرر ولا بيمسح تعديلاتك
import { PrismaClient, type StageKind } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SERVICE_TYPES = [
  "تأسيس شركة",
  "ترخيص صناعي",
  "إصدار / تعديل سجل تجاري",
  "رخصة بلدية",
  "ترخيص استثمار",
  "خدمات قوى والعمالة",
  "تأشيرات واستقدام",
  "شهادات الزكاة والضريبة",
  "التأمينات الاجتماعية",
  "خدمات التقييم",
  "دراسة جدوى",
  "استشارة إدارية",
  "أخرى",
];

const GOV_ENTITIES = [
  "وزارة التجارة",
  "المركز السعودي للأعمال",
  "وزارة الصناعة والثروة المعدنية",
  "وزارة الاستثمار",
  "منصة بلدي",
  "منصة قوى",
  "الهيئة السعودية للمقيمين المعتمدين (تقييم)",
  "وزارة الموارد البشرية والتنمية الاجتماعية",
  "هيئة الزكاة والضريبة والجمارك",
  "المؤسسة العامة للتأمينات الاجتماعية",
  "الغرفة التجارية",
  "المديرية العامة للدفاع المدني",
  "أخرى",
];

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

  // القوائم بتتملى مرة واحدة بس لو فاضية
  if ((await prisma.serviceType.count()) === 0) {
    await prisma.serviceType.createMany({ data: SERVICE_TYPES.map((name, order) => ({ name, order })) });
    console.log("✔ أنواع الخدمات");
  }
  if ((await prisma.govEntity.count()) === 0) {
    await prisma.govEntity.createMany({ data: GOV_ENTITIES.map((name, order) => ({ name, order })) });
    console.log("✔ الجهات الحكومية");
  }
  if ((await prisma.stage.count()) === 0) {
    await prisma.stage.createMany({ data: STAGES.map(([name, kind], order) => ({ name, kind, order })) });
    console.log("✔ مراحل المعاملات");
  }
}

main().finally(() => prisma.$disconnect());
