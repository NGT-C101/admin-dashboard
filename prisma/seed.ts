import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@company.com";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`حساب المدير موجود بالفعل: ${email}`);
    return;
  }
  await prisma.user.create({
    data: {
      name: "مدير النظام",
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
    },
  });
  console.log(`تم إنشاء حساب المدير: ${email}`);
}

main().finally(() => prisma.$disconnect());
