# منصة الإدارة

منصة إدارية داخلية لشركة الاستشارات: الموظفين، العملاء، الطلبات، الشؤون الإدارية، الحسابات، العلاقات العامة.

## التقنيات
- **Next.js** — الواجهة والسيرفر
- **PostgreSQL + Prisma** — قاعدة البيانات
- **Docker + Caddy** — التشغيل على السيرفر مع HTTPS تلقائي

## هيكل المشروع
| المسار | المحتوى |
|---|---|
| `prisma/schema.prisma` | جداول قاعدة البيانات |
| `src/lib/nav.ts` | الأقسام والأقسام الفرعية (القائمة الجانبية) |
| `src/lib/auth.ts` | تسجيل الدخول والصلاحيات |
| `src/app/(dashboard)/` | صفحات المنصة |
| `src/app/login/` | صفحة الدخول |

## التشغيل على السيرفر
```bash
git clone <رابط الريبو> admin-dashboard
cd admin-dashboard
cp deploy.env.example .env   # واملأ القيم
docker compose up -d --build
docker compose exec app node node_modules/tsx/dist/cli.mjs prisma/seed.ts   # أول مرة بس: إنشاء حساب المدير
```

## التحديث بعد أي تعديل
```bash
git pull
docker compose up -d --build
```
