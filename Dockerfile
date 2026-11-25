# ---- تثبيت المكتبات ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- بناء المشروع ----
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- التشغيل ----
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 TZ=Asia/Riyadh
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
# يطبّق تحديثات قاعدة البيانات + البيانات الافتراضية، وبعدين يشغّل المنصة
CMD ["sh", "-c", "npx prisma migrate deploy && node node_modules/tsx/dist/cli.mjs prisma/seed.ts && node server.js"]
