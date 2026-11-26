# PROJECT HANDOFF — NGT Admin Dashboard (منصة NGT للاستشارات الإدارية)

> Repository: `NGT-C101/admin-dashboard` (GitHub — currently **public**; owner advised to make it private) · Branch: `main`
> Production: **https://platform.ngt.sa**
> Owner company: legal name per VAT certificate **«شركة إن جي تي سي»**; brand/trade name **شركة نصار جروب التجارية للاستشارات الإدارية** (Nassar Group Trading — NGT), Riyadh, Saudi Arabia
> Product: internal Arabic (RTL) management platform for a Saudi administrative-consulting firm
> (government-platform transactions, company formation, licenses, HR, etc.)
> Last full rewrite of this document: **2026-11-26** (end of session 2). Updated in session 3 (same day): **تسليم المخرجات (deliverables)** built and deployed, then **transaction actions** (comments, assignment, pledge, extensions, warnings, priority, confidentiality, auto-distribution) built — see §2.3, §9.

---

## 0. TL;DR for the next developer

- **Stack:** Next.js 15 (App Router, Server Components + Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL 16 · Prisma 6 · Zod 4 · jose (JWT sessions) · bcryptjs · ExcelJS · lucide-react.
- **Runs in production** at **https://platform.ngt.sa** on one Hetzner VPS via Docker Compose (`db` Postgres + `app` Next.js standalone + `caddy` auto-HTTPS).
- **Visual identity:** dark **navy** shell + **gold** accents + NGT **red** primary buttons; light (white) cards on the dark background; real Riyadh skyline photo on the login page and the home banner (§5).
- **UI language:** formal Modern Standard Arabic (فصحى), RTL, Gregorian dates, Saudi time zone (`Asia/Riyadh`), SAR currency, Latin digits.
- **Done:** auth & granular permissions · Clients (full CRM) · Transactions (list, tracking board, **quotes/عروض الأسعار**, **deliverables/تسليم المخرجات**) · Employees/HR (profiles, leadership positions, org chart, leaves, attendance, payroll, performance) · self-service ("خدماتي") · settings (users, lists, **company profile/بيانات المنشأة**) · branding · Excel import/export · printable reports.
- **Not built yet (placeholder "قيد التطوير" pages):** **Administrative Affairs** (الشؤون الإدارية) · **Public Relations** (العلاقات العامة) · **Accounts** (الحسابات).
- **Owner decision (2026-11-26):** **Accounts is postponed until every other module is finished.** When it is built, the platform itself must issue ZATCA Phase-2 e-invoices (native Fatoora integration — not via Daftra).
- **Competitor analysis «تحليل منصة جهات»** (Jehat platform: 20 tutorial videos + presentation + user guide + 4 recent screen recordings) is a private artifact in the owner's claude.ai account: https://claude.ai/artifact/5hxxKfeh22KNajVxmY1TwE — its §«كيف ندمجها في خطتنا» **is the agreed roadmap** (see §6 Pending).
- **Next task:** **Administrative Affairs → الصادر والوارد** (correspondence with templates, review → approval cycle, outgoing numbering, QR verification page) — idea 4 of the Jehat analysis. Confirm details with the owner first.
- The owner is **non-technical**, uses a Mac, and communicates in **Egyptian Arabic**; explain steps in simple Arabic, give one copy-paste command per code block, and tell them exactly what to run on the server after each push.
- **Pushing to GitHub in this cloud environment requires an explicit approval message from the owner for each push** (the owner sends: «موافق، ارفع التعديلات الجديدة على GitHub»). Never put server IPs, secrets or personal data in the repo (it is public; the push classifier blocks it).

---

## 1. Architecture & folder structure

### 1.1 Runtime architecture

```
Browser ──HTTPS──► Caddy (ports 80/443, Let's Encrypt, domain from $DOMAIN = platform.ngt.sa)
                     │ reverse_proxy app:3000
                     ▼
                 Next.js standalone server (node server.js, TZ=Asia/Riyadh)
                   ├─ middleware.ts  → session-cookie gate (redirect to /login)
                   ├─ Server Components (pages)  → Prisma → PostgreSQL
                   ├─ Server Actions ("use server" files) → Prisma
                   ├─ Route handlers /api/*  (file download, Excel export, health)
                   └─ ./uploads (bind-mounted volume) ← uploaded documents
                 PostgreSQL 16 (named volume db-data, database `admin_dashboard`)
```

- No separate backend: all business logic is in Server Components / Server Actions / `src/lib/*`.
- Container start command (Dockerfile): `npx prisma migrate deploy && node node_modules/tsx/dist/cli.mjs prisma/seed.ts && node server.js`
  → **migrations and the idempotent seed run on every start/update.**

### 1.2 Folder structure

```
admin-dashboard/
├─ Dockerfile                 # 3-stage node:22-alpine build (deps → build → run), output: standalone, TZ=Asia/Riyadh
├─ docker-compose.yml         # db (postgres:16-alpine, POSTGRES_DB=admin_dashboard), app (build .), caddy (caddy:2-alpine); ./uploads bind mount
├─ Caddyfile                  # {$DOMAIN} { reverse_proxy app:3000 }
├─ deploy.env.example         # server .env template (DOMAIN, POSTGRES_*, SESSION_SECRET, ADMIN_*)
├─ .env.example               # local dev env template
├─ next.config.ts             # output standalone (unless STANDALONE=0), serverActions.bodySizeLimit = "11mb"
├─ PROJECT_HANDOFF.md         # this document
├─ scripts/
│  ├─ install.sh              # first-time server setup (apt upgrade, Docker, ufw, swap, .env generation, compose up, daily backup cron)
│  ├─ update.sh               # backup → git pull → docker compose up -d --build → image prune  (prints «تم التحديث»)
│  ├─ backup.sh               # pg_dump → /root/backups/db-STAMP.sql.gz + tar uploads → files-STAMP.tar.gz (keeps 14 each)
│  └─ restore.sh              # restore db (+ matching files archive), asks "yes"
├─ prisma/
│  ├─ schema.prisma           # full data model (see §3)
│  ├─ migrations/             # 11 migrations (see §3.4)
│  ├─ seed.ts                 # idempotent seed + one-time data migrations guarded by AppMeta keys
│  └─ catalog.ts              # service catalog per government entity (from company profile PDF)
├─ public/
│  ├─ brand/logo-silver.png   # logo for dark backgrounds (sidebar, login welcome side)
│  ├─ brand/logo-red.png      # logo for light backgrounds (login card, printed quotes/reports/payslips, quote watermark)
│  ├─ brand/riyadh-skyline.webp # Riyadh night skyline photo (750×335, 25 KB) — login background + home banner
│  └─ robots.txt              # Disallow: /  (internal system)
└─ src/
   ├─ middleware.ts           # auth gate; excludes _next, icons, /brand/, robots.txt, /api/health
   ├─ app/
   │  ├─ layout.tsx           # <html lang="ar" dir="rtl">, IBM Plex Sans Arabic (--font-plex) + Noto Kufi Arabic (--font-kufi), metadata from BRAND, robots noindex
   │  ├─ globals.css          # Tailwind v4 @theme (navy/gold/brand/chart palette), dark-shell variable inversion, component classes, print rules
   │  ├─ icon.png / apple-icon.png  # favicon / touch icon (generated from red logo)
   │  ├─ login/               # page.tsx (skyline photo background + glass card + welcome side), actions.ts (login/logout)
   │  ├─ api/
   │  │  ├─ health/route.ts           # {ok:true}
   │  │  ├─ files/[id]/route.ts       # authorized document download/inline view
   │  │  └─ export/[kind]/route.ts    # Excel: clients | contracts | template | attendance | payroll
   │  └─ (dashboard)/                 # everything behind login; layout = .app-shell (navy) + Sidebar + header
   │     ├─ layout.tsx                # requireUser({allowPasswordChange}), sidebar sections by permission, approvals badge, header with initials avatar
   │     ├─ page.tsx                  # home dashboard (banner, stats, recent tx, monthly chart, completion donut, upcoming, actions, section tiles)
   │     ├─ [section]/[sub]/page.tsx  # generic "قيد التطوير" placeholder for unbuilt sub-sections
   │     ├─ account/                  # حسابي: profile summary + change password (forced on first login)
   │     ├─ me/                       # خدماتي (employee self-service)
   │     ├─ clients/                  # CRM (directory, companies, contracts, communications, alerts, import, report)
   │     ├─ requests/                 # المعاملات
   │     │  ├─ actions.ts             #   transaction create/update/events
   │     │  ├─ quote-actions.ts       #   quote create/update/status/convert/duplicate/delete
   │     │  ├─ tx-actions.ts          #   assignTransaction, acceptTransaction (pledge), requestExtension, decideExtension, warnAssignee
   │     │  ├─ delivery-actions.ts    #   recordDelivery (optionally closes the tx to the first DONE stage), deleteDelivery (MANAGE)
   │     │  ├─ deliverables/          #   تسليم المخرجات: page (awaiting list + delivery log + KPIs), [id]/receipt/ (A4 delivery receipt)
   │     │  ├─ fields.tsx             #   transaction form fields
   │     │  ├─ all/ (list, new, [id]) #   transactions
   │     │  ├─ tracking/              #   Kanban board
   │     │  └─ quotes/                #   عروض الأسعار: page (list+KPIs), new/, [id]/ (detail+actions+edit), [id]/print/ (A4), QuoteFields.tsx (client form), options.ts
   │     ├─ employees/                # HR (management, profiles, org-chart, attendance, leaves, performance, payroll)
   │     └─ settings/                 # users (accounts & permissions), lists (stages, services, entities), company (بيانات المنشأة)
   ├─ components/             # shared UI (see §5): Sidebar, MonthlyChart, AttendanceWidget, ClientCompanyPicker, ServicePicker, tables, etc.
   │  └─ ui/                  # primitives: ActionForm, Field, PageHeader, Tabs, Badge, Collapsible, SearchBox, StageBadge, DateField/MonthField, Skyline (SVG)
   └─ lib/                    # domain logic & helpers (see below)
```

### 1.3 `src/lib` modules

| File | Purpose |
|---|---|
| `db.ts` | Prisma client singleton |
| `session.ts` | JWT (HS256, jose) encrypt/decrypt, cookie `session`, 8h max-age; `SESSION_SECRET` ≥ 32 chars; `INSECURE_COOKIES=1` disables `secure` |
| `auth.ts` | `getCurrentUser` (cached per request; loads permissions + employeeId), `requireUser`, `requireAdmin`, `can(user, section, level)`, `canAccess`, `requireSection(slug, level)` |
| `permissions.ts` | parse permission matrix from FormData (`perm_<DEPT>`, `isAdmin`), `savePermissions` (replace all), `PERMISSION_SECTIONS` |
| `nav.ts` | `SECTIONS` (6 departments + sub-sections → sidebar & routing), `DEPARTMENT_LABELS`, `findSection` |
| `brand.ts` | BRAND name, short, tagline, slogan, company, `logoOnDark`, `logoOnLight`, **`skyline`** — **single place to rename/rebrand** |
| `company.ts` | **company profile** (AppMeta `company-profile`): `getCompanyProfile`, `saveCompanyProfile`, `DEFAULT_PROFILE` (validity 10 days, default terms) |
| `quotes.ts` | `quoteNumber` (QT-0001), `quoteView` (derived EXPIRED), status labels/styles, `isEditable`, `PAYMENT_TERMS`, `lineTotal`/`quoteTotals` (halala arithmetic, VAT 15%) |
| `format.ts` | `formatSAR`, `formatDate`, **`formatDateLong`** (weekday), `formatDateTime` (locale `ar-SA-u-nu-latn-ca-gregory`, TZ Asia/Riyadh), `txNumber` (TR-0001), `dateInputValue` |
| `forms.ts` | Zod helpers: `optionalText`, `tenDigits`, `optionalMoney`, `optionalInt`, `optionalDate`, `firstError`, `uniqueError` (Prisma P2002 → Arabic), `FormState` type |
| `time.ts` | Riyadh date helpers (UTC+3 fixed): `riyadhToday`, `dateKey`, `parseDateKey`, `riyadhHM`, `riyadhDateTime`, `isWeekend` (Fri/Sat), `monthBounds`, `currentMonthKey`, `minutesText`, `GREGORIAN_MONTHS`, `monthLabel`, `DAY_MS` |
| `clients.ts` | client/contract/interaction labels & styles, `contractState`, `saudizationRate`, `whatsappLink`, `daysUntil`, `inDays`, `endOfToday`, **`daysText` (Arabic number agreement for days)** |
| `client-alerts.ts` | `getClientAlerts(scope)` — follow-ups, expiring documents & CRs (60d), ending contracts (30d) |
| `documents.ts` | doc type labels, limits (10 per client/company/employee/**transaction**, 5 per contract) via `maxDocsFor`, `docTypesFor(owner)` (transaction-only types CERTIFICATE/LETTER/PAYMENT_RECEIPT), `documentOwner` |
| `transactions.ts` | priority labels/styles, **`visibleTxWhere(user)` / `canSeeTx`** (confidential = assignee + admin only — apply to EVERY new transaction query), `awaitingAcceptance(Where)`, `canAssign`, `isManagerOf` (direct manager via Employee.managerId, or REQUESTS MANAGE; never self), `decidableExtensionsWhere`, **`pickAssignee`** (auto-distribution), `pledgeText`, `externalCommentWhatsapp` |
| `deliveries.ts` | `deliveryNumber` (DL-0001), channel labels/styles, `awaitingDeliveryWhere` (stage.readyForDelivery), `itemLines`, `deliveryWhatsapp` (wa.me link with prefilled MSA message) |
| `storage.ts` | file save/read/delete in `UPLOAD_DIR` (default `./uploads`), magic-byte type detection (PDF/JPG/PNG/WEBP), 10 MB max, random hex keys |
| `excel.ts` | ExcelJS helpers: RTL sheet with brand header style, `xlsxResponse`, `cellText` |
| `import-columns.ts` | client import template columns & report type |
| `hr.ts` | HR labels, `serviceText`/`serviceParts`, **`countText(n, [one, two, few, many])`**, **end-of-service benefit** (Saudi Labor Law art. 84/85), Saudi **IBAN mod-97** (`isValidSaudiIban`, `normalizeIban`, `formatIban`), `totalWage`, `initials`, `PERM_LEVEL_LABELS` |
| `hr-alerts.ts` | ID/iqama, passport, contract, probation, employee-document expiry alerts (60d) |
| `leave.ts` | leave labels, `holidaySet`, `workingDays`, **`annualBalance`** (21/30 days, pro-rated + carryover), `canDecide`, `pendingForWhere` |
| `attendance.ts` | `dayState` (present/late/leave/absent/holiday/weekend…), `attendanceData`, `monthSummary`, `lateMinutes`; respects `trackingStart` |
| `schedule.ts` | work schedule in AppMeta `work-schedule` (default 08:00–17:00, grace 15) |
| `payroll.ts` | payroll settings (AppMeta `payroll-settings`), `computeSlip`, `totals`, `eligibleWhere`, `isSaudi`, status labels |
| `performance.ts` | 7 criteria, rating bands, periods (Qn/Hn/year), `computeMetrics`, `canReview` |
| `positions.ts` | position level labels & styles |
| `leaders.ts` | `loadLeaders()` — leadership positions + holders for the "direct manager" dropdown |

---

## 2. Implemented features & modules

### 2.1 Platform foundation
- **Login page:** full-screen Riyadh skyline photo with navy overlays; light glass card (red logo, tagline, «تسجيل الدخول», email + password fields with icons, **show/hide password** toggle, red gradient button, "forgot password → contact the system admin" note, «بياناتك آمنة ومحمية»); welcome side on desktop («مرحباً بك في / منصة NGT» in gold gradient, slogan «نطور شركات الغد», 4 glass feature tiles: شريكك الدائم، تسهيل أعمالك، الالتزام بالأنظمة، نمو أكبر). On mobile only the card + slogan show.
- Login (email + password), logout, 8-hour JWT session cookie (httpOnly, sameSite lax, secure in prod).
- Forced password change on first login for accounts created with a temporary password (`mustChangePassword`); user is redirected to `/account?first=1` until changed.
- "حسابي" page: profile summary, permissions summary, change password.
- **Sidebar** (navy glass, silver logo, gold divider; active item = gold gradient pill with navy text; skyline SVG + gold slogan at the bottom): Home, **خدماتي** (if user has an employee profile), **تقييم أداء فريقي** (line managers without HR permission), **طلبات بانتظار موافقتي** (with count), the 6 department sections filtered by permission (expandable), Settings (admin only: المستخدمون والصلاحيات، **بيانات المنشأة**، القوائم والمراحل). Mobile drawer.
- **Header:** user initials avatar (navy + gold ring), name, role/job title, حسابي, خروج.
- **Home dashboard** (all numbers from real data, permission-filtered):
  - Banner: skyline photo, today's long date, slogan in gold, company name, quick actions (معاملة جديدة / العملاء / طلب إجازة per permission), welcome glass box with the count of items needing action.
  - Attendance widget (employees).
  - Stat tiles (dark glass, colored gradient icon tiles): open, overdue, my open transactions, clients, companies, client alerts, my due follow-ups, current staff, HR alerts, on leave today.
  - (requests permission) **المعاملات الحديثة** (last 5 updated) · **حركة المعاملات** (`MonthlyChart`: bars = new transactions, line = transactions that reached a DONE stage, per month, last 12 months, RTL time axis, hover `<title>` per month, "عرض البيانات كجدول") · **نظرة عامة** donut (completion rate = DONE / (DONE + OPEN); cancelled excluded) with open/done/overdue/cancelled counts.
  - **معاملاتي القادمة** (my 5 nearest due) · **تحتاج إجراء** (overdue tx, pending leave approvals, draft payroll run, my due follow-ups, expired client items, HR alerts) · **أقسام المنصة** tiles (first sub-page of each permitted section + settings for admins).
- Generic placeholder page for any sub-section not yet built.

### 2.2 Clients (العملاء) — CRM
- **Clients:** name, national ID/iqama (unique, 10 digits starting 1/2), phone(s) + WhatsApp link, email, nationality, city, status (LEAD/ACTIVE/INACTIVE), VIP, source, **account manager** (user), notes, archive (soft, managers only). Quick-create first company (name + CR) in the add-client form.
- **Client page (tabs):** overview (stats, info, edit, client alerts) · companies · documents · contracts · communications · transactions. Buttons: WhatsApp, **عرض سعر** (new quote), new contract, new transaction, monthly report, archive.
- **Companies:** CR number (unique, 10 digits) + expiry, unified number 700 (unique), VAT number (15 digits, starts/ends with 3), short national address (AAAA9999), MOL file no., GOSI no., legal form, city, activity, **Nitaqat** band, Saudi/non-Saudi headcount → **Saudization %**. Company page with tabs.
- **Documents:** up to 10 per client/company (5 per contract), typed, optional expiry with red/orange highlighting; PDF/images ≤10 MB; view/download/delete.
- **Contracts:** C-0001 numbering, one-time / monthly package / annual, value, start/end, auto-renew, terms, attachments; states active/ending(≤30d)/expired/cancelled/upcoming; renew (+1 month / +1 year) and cancel (MANAGE). Contracts list with KPIs (active, ending in 30d, monthly package revenue).
- **Communications log:** call/WhatsApp/meeting/visit/email/other, summary, follow-up date/time + assignee + note; overdue/today highlighting; "تمت المتابعة" toggle; views: my follow-ups, due, full log.
- **Alerts page (التنبيهات والمواعيد):** follow-ups (overdue + 7 days), contracts ending/ended, documents expiring (60d), CRs expiring (60d); "my clients only" filter.
- **Excel import** (template download → "check" pass with per-row errors → "import"); de-duplication by national ID, or name+phone; skips existing CR/unified numbers; up to 2000 rows, 5 MB.
- **Excel export:** clients + companies (2 sheets), contracts.
- **Monthly client report** (printable A4 / save as PDF with logo): month summary, transactions & last notes, companies status (CR expiry, Nitaqat, Saudization), documents needing renewal, contracts, communications.

### 2.3 Transactions (المعاملات)
- Transaction (TR-0001) per company: title, description, **government entity → filtered service** (ServicePicker), assignee, platform reference no., office fee + government fees (SAR), due date.
- Stages (configurable, 13 default) with kind OPEN/DONE/CANCELLED; event timeline (stage changes + notes, user & time).
- List with filters (status open/overdue/closed/all, stage, entity, service grouped by entity, assignee incl. "mine", free search incl. TR number/CR/platform ref).
- Tracking board (Kanban columns per OPEN stage, overdue highlighted, "mine only").
- **Service catalog:** ~84 services under 18 government entities seeded from the company profile + 6 general services; retired old generic services deactivated (not deleted).
- **Quotes (عروض الأسعار)** `/requests/quotes` — built 2026-11-26, deployed and verified by the owner:
  - QT-0001 numbering; client (required) + company (optional, must belong to the client); title; line items (optional catalog service — picking one pre-fills the description; description; quantity up to 2 decimals; unit price) — max 50 items; **live totals** in the form.
  - Amounts computed in **halalas** (`lib/quotes.ts`): `lineTotal = round(qty × price)`, VAT = round(subtotal × 15%); stored `subtotal`, `vatAmount`, `total`, `vatRate` per quote.
  - **Government fees estimate** (optional) is stored separately and printed in a separate box: paid to government bodies, **not part of the quote total, not taxed** (owner decision: government fees are billed outside the invoice).
  - Payment terms (free text + datalist: دفعة واحدة مقدماً، دفعة واحدة عند التسليم، 50% مقدماً و50% عند التسليم، أقساط، اشتراك شهري); notes/terms (pre-filled from company profile default terms).
  - Validity: `validUntil` defaults to today + company setting (**10 days**); cannot be in the past.
  - Status: DRAFT → SENT (sentAt) → ACCEPTED / REJECTED (optional reason) / CANCELLED (decidedAt). **EXPIRED is derived** (`quoteView`): DRAFT/SENT with `validUntil` < today. Editing allowed only while DRAFT/SENT (items are replaced on save).
  - Actions: تسجيل الإرسال، قبول، رفض (reason), إلغاء، **نسخ كعرض جديد** (fresh dates), حذف المسودة (MANAGE, DRAFT only), إعادة فتح كمسودة (MANAGE, from REJECTED/CANCELLED).
  - **Convert accepted quote → transaction** (once; `Quote.transactionId` unique): title = quote title, description = bullet list of items, fee = subtotal (pre-VAT), govFees = estimate, service/entity = first item with a catalog service, first active OPEN stage, event note «تم إنشاء المعاملة من عرض السعر QT-xxxx». Asks for the company if the quote has none.
  - List: KPIs (open quotes count + value, accepted this month count + value, expired without reply), status filter (السارية/منتهية الصلاحية/المقبولة/المرفوضة-الملغاة/الكل), search (number, title, client, company), days-left hint.
  - **Printable A4 quote / PDF** (`/requests/quotes/[id]/print`): title «عرض سعر / Quotation», number, dates; seller block from company profile (legal name, VAT no., **«الرقم الموحد»**, address, phone/email); buyer block (company or client, client name, company VAT, unified/CR number, city/address, phone); items table (navy header); totals; gov-fees box; payment terms, notes, validity sentence, bank + IBAN; footer; **NGT logo watermark** (red logo, ~6% opacity, rotated, centered, repeats per printed page). Warning on screen if the company profile is incomplete. **This is a quote, not a tax invoice.**
- **Transaction actions** — built in session 3 (owner decisions 2026-11-26), tested locally, **not yet pushed/deployed**:
  - **Priority** (عادية / مهمة / عاجلة) on create/edit; badge in list, board, detail; list filter.
  - **Confidential** checkbox: visible only to the **assignee and admins** (owner's choice — not even REQUESTS MANAGE or the creator). Enforced via `visibleTxWhere`/`canSeeTx` in: list, tracking board, detail (404), home "recent", client page (transactions + deliveries), company page, client monthly report, deliverables (pending + log), delivery receipt, file download, document upload, delivery recording, all tx actions. Aggregate counts (home tiles, client stats, performance metrics) still include them (numbers only).
  - **Auto-distribution** (owner: least busy): create form defaults to «توزيع تلقائي»; `pickAssignee` = active users with `autoAssign` whose `assignableServices` is empty (= all services) or contains the tx service; fewest OPEN transactions, then name. Also used when converting a quote. Configured per user in **Settings → Users → [user] → التوزيع التلقائي** (badge «مدرج في التوزيع» in the users list). No candidates → unassigned.
  - **Acceptance with pledge (استلام المعاملة بتعهد)** — owner: **mandatory**: while `assigneeId` set and `acceptedAt` null on an OPEN tx, the stage cannot change (select disabled + server check). The assignee sees a pledge panel (job title prefilled from the employee profile, committed completion date ≥ today → becomes `dueDate`, documents/originals received, 2 required pledges); stored in `TxAcceptance` with the exact `pledgeText`; shown as a fixed green record at the top. Reassignment resets `acceptedAt` → new assignee must accept. Home item «… مسندة إليك بانتظار استلامك بتعهد»; list filter «بانتظار استلامي»; "بانتظار الاستلام" hint in list/board. One-time seed `tx-acceptance-v1` marks all pre-existing assigned transactions as accepted so production work does not stop.
  - **Assignment with history** («إجراءات المعاملة» card): REQUESTS MANAGE, or an EDIT user who is the current assignee (transfer to a colleague) or when unassigned. Timeline event ASSIGN «أُسندت من X إلى Y». The assignee field was removed from the edit form.
  - **Extension request** (assignee only, after acceptance, one pending at a time, new date after the current one): approved/rejected by the requester's **direct manager or REQUESTS MANAGE** (owner's choice), never self. Approval updates `dueDate`. Home item «طلب تأجيل … بانتظار قرارك»; list filter «طلبات تأجيل بانتظار قراري». The due date in the edit form is now MANAGE-only (others must request an extension).
  - **Warning (لفت نظر)** to the assignee by their direct manager or REQUESTS MANAGE → red WARNING event.
  - **Internal vs external comments:** «تحديث المعاملة» has a «تعليق خارجي موجّه للعميل» checkbox; external comments get a green badge + «إرسال للعميل على واتساب» link. **The client monthly report now shows only external comments** (internal notes stay internal; old notes were all internal, so earlier months' report rows show «—»).
  - Timeline shows typed events (`TxEventType`: NOTE, ASSIGN, ACCEPT, EXTENSION, WARNING, DELIVERY) with colored dots/labels.
- **Deliverables (تسليم المخرجات)** `/requests/deliverables` — built in session 3 (2026-11-26), **deployed** (owner ran update.sh and tested):
  - **Outputs (المخرجات):** files uploaded on the transaction page (reuses `Document` with `transactionId`; same storage, 10 MB, PDF/images; max 10 per transaction; extra types شهادة / خطاب-إفادة / إيصال سداد). Upload = REQUESTS EDIT; delete = MANAGE or uploader; **a file included in a delivery cannot be deleted** (badge «سُلِّم للعميل»). Download via `/api/files/[id]` with REQUESTS VIEW.
  - **Delivery record (Delivery, DL-0001):** chosen output files + free-text paper originals (one per line, e.g. أصل السجل، ختم الشركة), date/time (Riyadh), channel (باليد / واتساب / البريد / مندوب / المنصة الحكومية / أخرى), recipient name (default = client), recipient ID (optional, 10 digits), phone (default = client phone), message to the client (external note). Several deliveries per transaction allowed (partial delivery). Saving adds a timeline event and, if the box is ticked (default), **moves the transaction to the first active DONE stage («مكتملة ومسلّمة»)**. Delete record = MANAGE (logged in the timeline).
  - **«جاهزة للتسليم» stage flag** (`Stage.readyForDelivery`, editable in Settings → Lists): seeded once ON for «صدرت / معتمدة» (AppMeta `deliveries-v1`). Awaiting-delivery list = transactions in a flagged, non-cancelled stage. Reason: in the default stage list the only DONE stage is «مكتملة ومسلّمة» (= already delivered), so «صدرت / معتمدة» is the real "ready, not delivered" state; old DONE transactions are intentionally **not** flagged as undelivered.
  - Page: KPIs (ready awaiting delivery, deliveries this month, waiting > 3 days), tabs «بانتظار التسليم» (oldest first, "ready since", partial-delivery hint) / «سجل التسليمات», search + "mine only".
  - **WhatsApp:** «إرسال على واتساب» opens wa.me with a formal message (greeting, tx title + TR number + company, the note, list of outputs, signature «فريق شركة نصار جروب التجارية»). Files must be attached manually in WhatsApp (no public file links by design).
  - **Printable receipt (إيصال تسليم مخرجات)** `/requests/deliverables/[id]/receipt`: A4 with watermark, seller/client blocks, transaction, items table (electronic copy vs original/paper, expiry), notes, acknowledgement sentence, signature lines for recipient and deliverer + stamp.
  - Shown on: transaction page (sections «المخرجات» + «سجل التسليم» + form), client page → المعاملات tab («سجل تسليم المخرجات»), home «تحتاج إجراء» (count awaiting delivery).

### 2.4 Employees / HR (الموظفين)
- **Employee profile** (EMP-0001): personal, identity (ID/iqama + expiry, passport + expiry), contact & emergency, job (title, department, direct manager, employment type, hire date, probation end, contract end, work location), salary (basic/housing/transport/other, bank, IBAN validated, GOSI flag), status (ACTIVE/ON_LEAVE/SUSPENDED/TERMINATED), termination (date + reason → **login auto-disabled**), reinstate, leave carryover. Profile header band is a navy gradient.
- Create employee **with a login account + permission matrix in the same form** (admin only); or grant login later from the profile "access" tab.
- Profile tabs: personal · job (reports, status change, termination) · leaves & attendance · performance · salary & **end-of-service benefit (indicative)** · documents · access (admin).
- Directory (cards with avatar initials, position badge, access summary, service duration), HR alerts panel, filters.
- **Leadership positions (الإدارة والمناصب القيادية):** 13 default positions in 3 levels, tree view, assign holder (auto-sets the holder's direct manager to the nearest filled position above; sets child-position holders' manager), add/edit/move/delete positions. Leadership appears first in the "direct manager" dropdown.
- **Org chart** built from `managerId`.
- **Leaves & permissions:** leave types (annual, sick, unpaid, marriage, bereavement, paternity, maternity, hajj, exam, other) and hourly "استئذان"; working-day counting (Sun–Thu) excluding official holidays; overlap & balance checks; approval by direct manager or HR-MANAGE (never self); cancel; on-behalf requests (HR EDIT); tabs: pending for me, all, who's away, balances (carryover editable by MANAGE).
- **Attendance:** self check-in/out (server time), daily board, manual correction (audited: `source=MANUAL`, `editedById`, note), monthly report with commitment %, Excel export, work schedule & grace, official holidays (Founding Day 22 Feb, National Day 23 Sep seeded for 2 years; Eids added manually).
- **Payroll:** monthly run DRAFT → APPROVED → PAID; auto-computed slips (pro-ration on 30-day basis, absence & unpaid-leave deduction, optional lateness deduction, GOSI employee share), manual overtime/bonus/other deduction preserved on recalculation; bank transfer Excel; printable payslip; employees see approved slips in خدماتي. MANAGE only.
- **Performance reviews:** quarterly/half/annual; 7 criteria scored 1–5; auto metrics snapshotted on submit; strengths/improvements/goals; DRAFT → SUBMITTED → ACKNOWLEDGED (employee comment); reopen (MANAGE); printable.

### 2.5 Self-service (خدماتي, `/me`)
Attendance widget · annual leave balance · leave/permission request form · my requests · pending performance review to acknowledge · my reviews · my payslips · my monthly attendance calendar.

### 2.6 Settings (admin only)
- **المستخدمون والصلاحيات:** all accounts with access summary; standalone account creation (not linked to an employee); per-user page: permission matrix, activate/deactivate, set temporary password.
- **بيانات المنشأة** `/settings/company`: legal name (required), VAT number (15 digits 3…3), unified CR number (10 digits), national address, phone, email, bank name, IBAN (mod-97, stored normalized), quote validity days (1–90, default 10), default quote terms. Stored in AppMeta `company-profile`. **Values are entered by the owner in production and are intentionally not in the repo.** The owner has filled them (legal name «شركة إن جي تي سي», VAT no., unified number, Riyadh/Al-Mishael address, phone, email, Al Rajhi IBAN).
- **القوائم والمراحل:** stages (order, kind, active), government entities, services grouped by entity (move between entities, deactivate).

### 2.7 Branding
Name «منصة NGT للاستشارات الإدارية», slogan «نطور شركات الغد», `BRAND.company` «شركة نصار جروب التجارية» (used as fallback seller name if the company profile is empty); logos extracted from the company profile PDF (silver & red); `BRAND.skyline` = skyline photo. The navy/gold identity was chosen by the owner from two reference mockups (login + dashboard) on 2026-11-26; an earlier "السدو الرقمي" maroon/sand concept was implemented then replaced the same day.

---

## 3. Database schema

PostgreSQL 16, Prisma 6 (`prisma-client-js`, `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`).

### 3.1 Enums
| Enum | Values |
|---|---|
| `Role` | ADMIN, MANAGER*, EMPLOYEE (*legacy; only ADMIN vs non-ADMIN matters now) |
| `Department` | EMPLOYEES, CLIENTS, REQUESTS, ADMIN_AFFAIRS, ACCOUNTS, PR (= platform sections) |
| `PermLevel` | VIEW, EDIT, MANAGE |
| `ClientStatus` | LEAD, ACTIVE, INACTIVE |
| `StageKind` | OPEN, DONE, CANCELLED |
| `DocType` | CR, NATIONAL_ID, BALADY_LICENSE, NATIONAL_ADDRESS, ZAKAT_CERT, VAT_CERT, OTHER_LICENSE, CONTRACT, PASSPORT, WORK_CONTRACT, QUALIFICATION, OTHER |
| `ContractType` | ONE_TIME, MONTHLY, ANNUAL |
| `InteractionType` | CALL, WHATSAPP, MEETING, VISIT, EMAIL, OTHER |
| `EmployeeStatus` | ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED |
| `EmploymentType` | FULL_TIME, PART_TIME, TEMPORARY, TRAINEE |
| `Gender` | MALE, FEMALE |
| `RequestKind` | LEAVE, PERMISSION |
| `LeaveType` | ANNUAL, SICK, UNPAID, MARRIAGE, BEREAVEMENT, PATERNITY, MATERNITY, HAJJ, EXAM, OTHER |
| `RequestStatus` | PENDING, APPROVED, REJECTED, CANCELLED |
| `PositionLevel` | EXECUTIVE, SENIOR, DEPARTMENT |
| `PayrollStatus` | DRAFT, APPROVED, PAID |
| `ReviewStatus` | DRAFT, SUBMITTED, ACKNOWLEDGED |
| `QuoteStatus` | DRAFT, SENT, ACCEPTED, REJECTED, CANCELLED (EXPIRED is derived, not stored) |
| `DeliveryChannel` | HAND, WHATSAPP, EMAIL, COURIER, PLATFORM, OTHER |
| `TxPriority` | NORMAL, HIGH, URGENT |
| `TxEventType` | NOTE, ASSIGN, ACCEPT, EXTENSION, WARNING, DELIVERY |
| `ExtensionStatus` | PENDING, APPROVED, REJECTED |
| `DocType` (added) | CERTIFICATE, LETTER, PAYMENT_RECEIPT (transaction outputs only) |

### 3.2 Models & relationships (key fields)
- **User**: email (unique), passwordHash (bcrypt 10 rounds), role, department (legacy, now null), active, mustChangePassword → `permissions[]`, `employee?` (1–1 via Employee.userId), managed clients, created/assigned transactions, events, documents uploaded, contracts created, interactions (creator/assignee), leave requests (creator/decider), attendance edits, payroll runs (creator/approver), reviews given, **createdQuotes[]**.
- **Permission**: (userId, section) unique, level. Cascade on user delete.
- **Client** → companies[], documents[], contracts[], interactions[], **quotes[]**, accountManager (User?), archivedAt.
- **Company** → client (required), transactions[], documents[], contracts[], interactions[], **quotes[]**; unique crNumber, unifiedNumber; vatNumber, nationalAddress, city…
- **GovEntity** (unique name) → services[], transactions[]. **ServiceType** (unique [name, govEntityId]; null entity = general service) → transactions[], **quoteItems[]**.
- **Stage** (unique name, order, kind, active) → transactions, events.
- **Transaction** (number autoincrement unique) → company, serviceType?, govEntity?, stage, assignee (User?), createdBy, events[], **quote?** (back-relation of Quote.transactionId); fee/govFees Decimal(12,2), dueDate.
- **TransactionEvent** → transaction (cascade), stage?, user, note.
- **Document** → exactly one of client/company/contract/employee; storageKey unique; expiresAt; uploadedBy.
- **Contract** (number autoincrement) → client, company?, documents[], createdBy; value Decimal, start/end, autoRenew, cancelledAt.
- **Interaction** → client, company?, createdBy, assignee?; followUpAt/followUpDone.
- **Employee** (number autoincrement) → user? (unique), manager? (self relation "Reports") / reports[], position? (1–1 via Position.holderId), documents[], leaveRequests[], attendance[], payslips[], reviews[]; nationalId unique; salary Decimals; leaveCarryover Int.
- **Position** (unique title) → parent?/children (tree "PositionTree"), holder Employee? (holderId unique), level, scope, order.
- **LeaveRequest** (number) → employee, createdBy, decidedBy?; startDate/endDate `@db.Date`, days (working days), start/endTime + minutes for PERMISSION.
- **Holiday**: name, startDate/endDate `@db.Date`.
- **Attendance**: unique (employeeId, date `@db.Date`), checkIn/checkOut timestamps, source SELF/MANUAL, note, editedBy.
- **PayrollRun** (month unique "YYYY-MM") → slips[] (cascade), createdBy, approvedBy.
- **Payslip**: unique (runId, employeeId); all amounts Decimal(12,2); paidDays, absenceDays, lateMinutes; bank snapshot.
- **PerformanceReview**: unique (employeeId, period); scores Json, metrics Json, overall Float; reviewer (User).
- **Quote** (number autoincrement unique) → client (required, RESTRICT), company? (SET NULL), items[] (cascade), createdBy (User), transaction? (`transactionId` unique, SET NULL); title, `issueDate`/`validUntil` `@db.Date`, status, `vatRate` Decimal(5,2) default 15, `subtotal`/`vatAmount`/`total` Decimal(12,2), `govFees` Decimal?, paymentTerms?, notes?, rejectReason?, sentAt?, decidedAt?; indexes on clientId, status.
- **QuoteItem** → quote (cascade), serviceType? (SET NULL); order, description, quantity Decimal(10,2) default 1, unitPrice Decimal(12,2), lineTotal Decimal(12,2).
- **Delivery** (number autoincrement unique, DL-0001) → transaction (cascade), deliveredBy (User "DeliveredBy"), documents[] (implicit m2m `_DeliveryDocuments`); deliveredAt, channel, recipientName, recipientIdNo?, recipientPhone?, items? (lines), note?.
- **Document.transactionId?** (outputs of a transaction, SET NULL) · **Stage.readyForDelivery** Boolean default false.
- **Transaction** + `priority`, `confidential`, `acceptedAt?`, acceptances[], extensionRequests[] · **TransactionEvent** + `type`, `external`, `targetUser?` ("EventTarget") · **User** + `autoAssign`, `assignableServices` (m2m `_AssignableServices` with ServiceType).
- **TxAcceptance** → transaction (cascade), user; jobTitle?, committedDue, documents?, pledgeText.
- **ExtensionRequest** → transaction (cascade), requestedBy, decidedBy?; currentDue?, requestedDue, reason, status, decidedAt?, decisionNote?.
- **AppMeta** (key/value) — config & one-time-migration flags.

### 3.3 AppMeta keys (configuration & one-time migrations)
| Key | Meaning |
|---|---|
| `catalog-v1` | service catalog sync done (seed.ts `syncCatalog`) |
| `permissions-v1` | legacy role/department → Permission rows migration done |
| `holidays-v1` | fixed Gregorian holidays seeded |
| `positions-v1` | default leadership positions seeded |
| `deliveries-v1` | «صدرت / معتمدة» stage flagged `readyForDelivery` (once) |
| `tx-acceptance-v1` | existing assigned transactions marked accepted (once, when the mandatory pledge was introduced) |
| `work-schedule` | JSON `{start, end, grace}` |
| `payroll-settings` | JSON `{gosiSaudiRate, gosiNonSaudiRate, gosiCap, deductAbsence, deductLate}` |
| `company-profile` | JSON `{legalName, vatNumber, crNumber, address, phone, email, bankName, iban, quoteValidityDays, quoteTerms}` |

> Pattern: new one-time data changes go into `prisma/seed.ts` guarded by a new AppMeta key; seed runs at every container start and must stay idempotent and **non-destructive**.

### 3.4 Migrations (in order)
`init` → `clients_transactions` → `services_by_entity` → `documents` → `clients_crm` → `client_archive` → `employees_permissions` → `leaves_attendance` → `positions` → `payroll_performance` → `20261126031520_quotes` (enum QuoteStatus, tables Quote & QuoteItem, FKs; additive only) → `20261126162847_deliveries` (enum DeliveryChannel, 3 DocType values, Document.transactionId, Stage.readyForDelivery, tables Delivery & _DeliveryDocuments; additive only) → `*_transaction_actions` (enums TxPriority/TxEventType/ExtensionStatus, Transaction/TransactionEvent/User columns, tables TxAcceptance, ExtensionRequest, _AssignableServices; additive only). None drop data (one early migration dropped/re-created a unique index on ServiceType name).

### 3.5 Configuration / environment
- Server `.env` (generated by `install.sh`, chmod 600, never committed): `DOMAIN` (= `platform.ngt.sa`), `POSTGRES_USER`, `POSTGRES_PASSWORD`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- App env (compose): `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `UPLOAD_DIR=/app/uploads`; Dockerfile sets `NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 TZ=Asia/Riyadh`.
- Local dev `.env`: `DATABASE_URL`, `SESSION_SECRET` (dev seed creates `admin@company.com` / `admin123` **only when NODE_ENV≠production**). `tsx prisma/seed.ts` does **not** load `.env` by itself → run `set -a && . ./.env && set +a` first.
- Optional: `INSECURE_COOKIES=1` (HTTP testing), `STANDALONE=0` (local `next start`).
- Fonts are fetched from Google Fonts by `next/font` **at build time** (the server build needs outbound HTTPS, already working).

---

## 4. Authentication & permissions

- **Session:** JWT `{userId}` signed HS256 with `SESSION_SECRET`, cookie `session`, 8h. `getCurrentUser()` re-reads the user each request → deactivation is immediate; password change does **not** revoke other existing sessions.
- **Middleware** only checks cookie validity (Edge); real authorization happens server-side in every page and action.
- **Model:** `isAdmin` (role ADMIN) = full access to everything incl. Settings and granting permissions. Otherwise per-section `Permission(level)`:

| Level | Meaning (enforced) |
|---|---|
| none | section hidden; URLs redirect to `/` |
| VIEW | read pages; add/edit UI hidden |
| EDIT | create/update records (clients, companies, contracts, interactions, documents upload, transactions, **quotes incl. send/accept/reject/cancel/convert/duplicate**, employee non-salary data, attendance correction, on-behalf leave requests, performance reviews) |
| MANAGE | EDIT + delete/archive/renew/cancel, **delete draft quotes, reopen rejected/cancelled quotes**, employee **salaries, IBAN, documents, termination, payroll, carryover, positions, schedule/holidays**, reopen reviews |

- Quotes and deliverables live under the **REQUESTS** section (`requireSection("requests", …)`); print pages (quote, delivery receipt) need VIEW; recording a delivery / uploading outputs = EDIT; deleting a delivery record = MANAGE. Company profile = **admin only** (`requireAdmin`).
- Helpers: `requireSection(slug, level)` in every action/page; `can(user, slug, level)` for UI gating.
- **Special rules:** line managers can approve their team's leave and review their team **without** HR permission (`canDecide`, `canReview`); nobody approves/reviews themselves. Employee documents visible to HR-MANAGE or the employee. Payslip visible to HR-MANAGE or the employee after run approval. Granting logins/permissions = admin only. An admin cannot remove their own admin role.
- **Sensitive-data hiding for HR VIEW:** national ID, birth date, address, emergency contact, salary tab, documents tab.
- Passwords: min 10 chars for new/temporary passwords; bcrypt.

---

## 5. UI/UX design system & conventions

- **Language:** formal MSA everywhere in UI (no Egyptian colloquial). Error style: "يرجى …", "يجب …", "لا توجد …", "مسجّل مسبقاً". Arabic number agreement via `daysText` / `countText(n, [one, two, few, many])` (e.g. `["طلب واحد","طلبان","طلبات","طلباً"]`). When "و" precedes a digit, a space is inserted (rendering issue). Avoid emoji in new UI (some old success messages still contain ✅).
- **Direction & locale:** RTL, fonts **IBM Plex Sans Arabic** (`font-sans`) and **Noto Kufi Arabic** (`font-display`; `h1, h2` use it via base layer), Latin digits, Gregorian calendar, `Asia/Riyadh`, SAR via `formatSAR`. Numbers/IDs/phones/IBAN rendered with `dir="ltr"`; time axes run right-to-left (oldest on the right).
- **Palette** (`globals.css @theme`): `navy-50…950` (shell; `#070F24` darkest, `#0B1733` 900), `gold-100…700` (accent/active; `#D4A548` = 500), `brand-*` NGT red/maroon (`#B10302` = 600), `chart-1` `#3559B5` / `chart-2` `#B07A12` (validated with the dataviz palette validator: lightness, chroma, CVD ΔE ≥ 26, contrast ≥ 3:1 on white), `ivory` `#F7F3EE`, `ink` `#1F1A17`. Semantic colors: emerald (ok/approved/done), amber (soon/pending), rose (expired/rejected/overdue), sky (info/open/leave), violet (holiday).
- **Dark shell mechanism (important):** `(dashboard)/layout.tsx` wraps everything in `.app-shell` (screen media only — **print stays white**). Inside it the `--color-neutral-*` CSS variables are **inverted** (light text on navy). They are **restored to light values** inside light containers: `.card`, `.input`, `.btn-secondary`, `[class~="bg-white"]`, `input/select/textarea`, `dialog`. `--heading` (h1 color) and `--link` follow the same logic: white/gold outside cards, navy/maroon inside. `text-brand-700/800` become gold outside cards; `border-brand-600` becomes gold. ⇒ Existing pages built with `.card` + neutral utilities work unchanged; **new content placed directly on the navy background must use light text** (`text-white`, `text-navy-100`) or `.card-dark`. Note `bg-white/80` etc. do **not** match the restore selector.
- **Component classes:** `.input`, `.btn-primary` (red→maroon gradient), `.btn-secondary` (white), `.btn-gold`, `.card` (white, rounded-2xl, shadow), `.card-dark` (navy glass), `.table`, `.link`, `.stat-value` (Kufi, big tabular number), `.text-gold-gradient`.
- **Primitives:** `ActionForm` (useActionState; submits via `startTransition` so fields are **not cleared on validation errors**; resets on success unless `resetOnSuccess={false}`; its submit button is always `.btn-primary`), `Field`/`FieldGrid`, `PageHeader` (breadcrumbs + actions), `Tabs` (URL `?tab=`), `Badge`, `Collapsible`, `SearchBox` (GET `?q=`), `StageBadge`, **`DateField`** (day select + Gregorian month names + typed year → hidden `YYYY-MM-DD`; `withTime`) and `MonthField`. **No native `type="date"/"month"/"datetime-local"` inputs.** `Skyline` = deterministic SVG Riyadh skyline (seeded PRNG so SSR = client), used at the bottom of the sidebar. `MonthlyChart` = server-rendered SVG (bars + line, one y-axis, every-other-month labels, `<title>` hover, `<details>` table view).
- **Images:** `next/image` for logos and the skyline photo (`fill` + `object-cover`), photo path from `BRAND.skyline`.
- **Patterns:** list page → KPIs (optional, `.card-dark`) → search/filters → table in `.card` with `overflow-x-auto` → detail page with header card, actions card, content cards, edit form in `Collapsible`; printable pages: `print:hidden` toolbar + A4 `<article class="bg-white …">` with logo (quotes add the watermark); Excel exports via plain `<a href="/api/export/...">`.
- **Mobile:** responsive grids (`grid-cols-1` + `[&>*]:min-w-0` on dashboard grids to avoid overflow), sidebar drawer; verified **no horizontal scroll at 390px** on home and key pages after the redesign.

---

## 6. Completed vs pending

### Completed
Phases (all on `main`): foundation → clients & transactions → server deployment → password page → branding → services by entity → documents → clients CRM batch 1 & 2 → formal Arabic → HR batch 1 (profiles + permission system) → HR batch 2 (leaves + attendance) → leadership positions + Gregorian date fields → HR batch 3 (payroll + performance) → **[2026-11-26]** navy/gold visual identity + new home dashboard + real skyline photo → custom domain `platform.ngt.sa` + server security updates/reboot → handoff update → **quotes (عروض الأسعار) + company profile (بيانات المنشأة)** → quote watermark → «الرقم الموحد» label on printed quotes → full handoff (`e2368f4`) → **[session 3] deliverables** (`09fad63`, pushed + deployed) → **transaction actions** (local, not pushed yet).

Commits of session 2 (oldest → newest): `4ba521a` السدو الرقمي identity (superseded) · `e3c7b61` navy/gold identity + new home · `76cd1a5` skyline photo · `e55d743` handoff update · `e893d9b` quotes + company profile (+ SearchBox icon fix) · `0b36088` quote watermark · `9c3cbbe` «الرقم الموحد» label · `e2368f4` handoff (all pushed).

### Pending (not started), in the agreed order (from the Jehat analysis artifact, §0)
1. ~~Transaction actions upgrade~~ **done in session 3**. Not done from that idea list: printable pledge receipt for the client, bulk transfer of an employee's transactions, «مراجعة معاملات موظف» view, notifications (in-app bell) for assignment/extension/warning.
2. **Administrative Affairs (الشؤون الإدارية):** starts with correspondence in/out (الصادر والوارد) with templates, NGT letterhead + hide-logo option, **review → approval cycle**, outgoing number, Hijri + Gregorian date, **QR code to a public verification page**; then archive & documents search, assets & custody (الأصول والعُهد), procurement & suppliers.
3. **Public Relations (العلاقات العامة):** events & conferences, partnerships & external bodies, campaigns & media content, customer satisfaction surveys.
4. **Client portal** (big separate phase): client logs in, sees transactions/status/external comments, uploads requested documents, approves quotes, receives outputs. Also: authorized representatives (المفوضون) per client/company, camera capture of documents, appointments calendar with reminders.
5. **Cross-cutting:** global search (header search bar like the owner's mockup), notification center/bell (in-app; later email/WhatsApp), audit log, login hardening.
6. **Accounts (الحسابات) — LAST, by owner decision:** invoices with **native ZATCA Phase-2 issuance**, payment plans (one-time / installments / monthly subscription from contracts), collections & receivables aging, credit/debit notes, expenses (link payroll), financial reports, Excel export.

### Owner decisions already collected (for Accounts)
- VAT-registered (effective 2025-09-01, quarterly filing). Company data entered in بيانات المنشأة.
- Invoices are currently issued from **Daftra**; owner wants **the platform itself** to issue invoices (no Daftra integration). Unknown whether their Daftra plan has an API (irrelevant now).
- **Government fees are outside the invoice.**
- Payment patterns: one-time, installments and monthly subscriptions — all used.
- Quote validity: 10 days (implemented).
- Still to ask: B2B "standard" vs B2C "simplified" invoices (or both); whether historical Daftra invoices need credit notes when switching.

---

## 7. Known bugs & unresolved issues

1. **Success message disappears** when a successful action re-renders the page and the form is replaced (e.g., grant login, approve request, quote status buttons). Functional, UX only.
2. Permission-denied **server actions redirect to `/`** silently instead of showing an error (only reachable if UI gating is bypassed).
3. The "تمت المتابعة" (follow-up done) button is shown to VIEW-only users; the action then redirects home.
4. Password change does not invalidate other active sessions (JWT, 8h).
5. **No login rate limiting / lockout.**
6. Legacy fields `User.department` and role `MANAGER` remain in schema (unused after permissions-v1).
7. Employee profile computes **all** HR alerts then filters (inefficient at scale); annual balances table computes per employee sequentially.
8. Performance transaction metrics only work for employees **with a login** (transactions are assigned to `User`, not `Employee`).
9. Payroll simplifications: sick-leave pay tiers (art. 117) not applied; employer GOSI share not tracked; GOSI rates are configurable defaults (9.75% Saudi / 0% non-Saudi, cap 45,000) — **must be verified**; lateness deduction off by default; 30-day basis.
10. Leave days counted as **working days** (Sun–Thu) — owner has not confirmed vs calendar days. Annual balance per calendar year; carryover manual.
11. Attendance `trackingStart` = earliest attendance record company-wide; **no geofencing** — owner not yet asked.
12. Org-chart / positions tree is a long vertical list on large structures.
13. **No automated test suite** (verification uses ad-hoc Playwright scripts kept outside the repo).
14. Lint: 0 errors, 5 warnings (unused eslint-disable directives, unused `_f` / `_active`) — harmless.
15. Prisma warns `package.json#prisma` is deprecated (move to `prisma.config.ts` before Prisma 7).
16. **Legal/compliance (PDPL):** server is in **Germany (Hetzner Nuremberg)** while data includes Saudi national IDs → data-residency concern; owner interested in Google Cloud Dammam (see §10). Not resolved.
17. Security hygiene: SSH key-only. Confirm the initial platform admin password was changed.
18. `prisma migrate dev` fails in non-interactive shells when a change has warnings — use the `migrate diff` workflow in §8.
19. **Repository is public** on GitHub; owner was asked to make it private (Settings → General → Danger Zone → Change visibility). Not confirmed.
20. **Skyline photo:** supplied by the owner from an unknown web source (rights not verified; owner accepted responsibility) and only 750×335 px → slightly soft on large screens. Replace with a licensed high-resolution image when available (`public/brand/riyadh-skyline.webp`, same path).
21. Quote actions: all buttons use the primary (red) style because `ActionForm` has a single button style; reject/cancel are not visually distinguished. No confirmation dialog on cancel/delete.
22. Quote print is a **quotation only** — not a ZATCA tax invoice (no QR/UUID). Do not let users treat it as an invoice.
23. Domain email: Hostinger mail DNS records (not created by the owner) were deleted from `ngt.sa`; the company currently has **no email on its domain**. Owner was advised to change the dnet password and ask dnet who added them. Unresolved.
24. Production contains a quote **QT-0001 «تأسيس شركة»** for a client «شركة NGT للاستشارات الاداريه» created by the owner while testing — the owner may want to cancel/delete it.
25. Deliveries: WhatsApp button only opens a prefilled chat — files are attached manually (no public links). `Tabs` links drop the search/"mine" filters when switching tabs on the deliverables page. No confirmation dialog on «حذف السجل».
26. Session-3 local testing used a second local DB (`admin_dashboard2`) because `prisma migrate reset` is blocked by Prisma's AI-consent guard; that is local-only and irrelevant to production.
27. Transaction actions: no notification bell yet — assignees/managers find pending items via home «تحتاج إجراء» and list filters. Success messages of accept/extension/assign disappear after the page refreshes (same as item 1). The «توزيع تلقائي» default applies only on the create form and quote conversion (not on CSV/other imports — none exist yet).

---

## 8. Important technical decisions & dependencies

- **Server Actions over REST**; Zod validation in every action; Arabic error messages; Prisma unique errors mapped by `uniqueError`.
- **Timezone:** date-only fields stored as `@db.Date` / UTC midnight of the Riyadh calendar day; times displayed with `timeZone: Asia/Riyadh`; containers run with `TZ=Asia/Riyadh`. **Run local dev with `TZ=Asia/Riyadh`.** Month bucketing for charts uses `dateKey(riyadhToday(d))`.
- **Money:** Decimal(12,2) in DB; quote math done in integer halalas (`lib/quotes.ts`) to avoid float errors; VAT rate stored per document.
- **Company/legal data lives in AppMeta (`company-profile`), not in code** — the repo is public, and values must be editable by the admin.
- **No secrets, server IP, IBAN or personal data in the repo or this document.** The cloud agent's push classifier rejected a push that contained the server IP.
- **Files** stored on disk (`./uploads`, bind mount), type detected by magic bytes, served only through `/api/files/[id]` with permission checks, `nosniff`, `no-store`. Included in daily backups.
- **Docker image** = node:22-alpine **without extra apk packages** (Alpine ships libssl3; Prisma target pinned). Standalone Next output + full node_modules copied (needed for `prisma migrate deploy` and `tsx` seed at start).
- **Idempotent seed** with AppMeta guards instead of data migrations in SQL. **Catalog sync** never deletes (deactivates).
- **Permissions** replaced role/department model (migration `permissions-v1`). **Positions** as a separate tree.
- **Design-system mechanism:** dark shell by CSS-variable inversion (§5) instead of touching every page; charts are hand-written SVG server components (no chart library); fonts via `next/font/google`.
- **Formal Arabic** is a product requirement; keep new text in MSA.
- **ZATCA e-invoicing (for the future Accounts module):** owner chose **native** issuance. Requirements to implement: UBL 2.1 XML, invoice hash chain (PIH), ICV counter, UUID, ECDSA cryptographic stamp, QR (TLV), CSR → compliance CSID → compliance checks → production CSID onboarding using an OTP from the Fatoora portal (owner action); **clearance API** for B2B standard invoices, **reporting API** (≤24h) for B2C simplified. Develop/test against the ZATCA developer-portal sandbox first. Private key/certificate must live only on the server (never in git/chat). The cloud dev environment may need its network allowlist extended to reach ZATCA sandbox hosts. Wave 25 threshold SAR 187,500 (2022–2025 revenue), integration deadline 2027-02-01. References: ZATCA *E-invoicing Detailed Technical Guideline*, *Developer Portal Manual*, *Fatoora Portal User Manual*.
- **Dependencies:** next 15.5.29, react/react-dom 19.1.0, @prisma/client + prisma ^6.19.3, zod ^4, jose ^6, bcryptjs ^3, exceljs ^4.4.0, lucide-react, server-only; dev: tailwindcss ^4 + @tailwindcss/postcss, typescript ^5, eslint 9 + eslint-config-next, tsx.
- **Creating a migration non-interactively** (used for `quotes`):
  ```bash
  su postgres -c "psql -c 'DROP DATABASE IF EXISTS shadow_tmp' -c 'CREATE DATABASE shadow_tmp OWNER <user>'"
  M=prisma/migrations/$(date -u +%Y%m%d%H%M%S)_name && mkdir -p $M
  npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
    --shadow-database-url "postgresql://USER:PASS@localhost:5432/shadow_tmp" --script > $M/migration.sql
  npx prisma migrate deploy && npx prisma generate
  ```
  Always inspect the SQL for `DROP` statements and **never commit an empty migration**.
- **Local dev quick start:** Postgres 16 running (`pg_ctlcluster 16 main start` in the cloud container — it stops when the container sleeps), `.env` with `DATABASE_URL` + `SESSION_SECRET`, then `npm ci && npx prisma migrate deploy && (set -a; . ./.env; set +a; npm run db:seed) && TZ=Asia/Riyadh npm run dev` (or `STANDALONE=0 npx next build && TZ=Asia/Riyadh npx next start`). When restarting `next start`, kill `next-server` (not just `next start`) or an old server keeps serving stale chunks.
- **Verification habit:** `npx tsc --noEmit`, `npx eslint src`, `next build`, then Playwright screenshots (desktop 1440 + mobile 390, check `scrollWidth`) and PDF render for print pages.

---

## 9. Exact current status (end of 2026-11-26)

- **Session 3, part 2:** transaction actions built on top of `09fad63`; `tsc` clean, eslint 0 errors / 5 old warnings, `next build` OK; Playwright E2E with 4 roles (admin; Khaled = EDIT + line manager; Sara = EDIT, reports to Khaled, auto-assign; Fahad = EDIT, auto-assign) passed: auto-assign to least busy, stage locked before acceptance, pledge accepted + record, external comment + WhatsApp link, extension requested → self-approval impossible → manager approved → due date updated, warning, transfer resets acceptance, confidential tx hidden from Fahad (list, board, URL 404) and visible to Sara, service-restricted distribution, no horizontal scroll at 390 px. **Not pushed yet** — needs the owner's approval message.
- **Session 3 (2026-11-26):** deliverables built on top of `e2368f4`; `tsc` clean, eslint 0 errors / 5 old warnings, `next build` OK, Playwright E2E passed (upload output → validation → record delivery with auto-close → WhatsApp text → receipt PDF 1 page → log → client tab → home item → stage flag toggle; no horizontal scroll at 390 px). Pushed as `09fad63` after the owner's approval (repo attached with push access on the second request) and deployed by the owner. After deploy, `update.sh` applies migration `20261126162847_deliveries` and seed step `deliveries-v1` automatically.
- **Code (end of session 2):** local `main` at **`9c3cbbe`** («عرض السعر: تسمية «الرقم الموحد» …») — **1 commit ahead of `origin/main` (`0b36088`) and NOT pushed** (waiting for the owner's push approval; if lost, re-apply: on the quote print page label the company-profile `crNumber` and the buyer company's `unifiedNumber` as «الرقم الموحد», and fall back to «السجل التجاري» for a company `crNumber`). Plus this document (uncommitted until the next commit). Builds cleanly, `tsc` clean, eslint 0 errors / 5 warnings.
- **Production:** `https://platform.ngt.sa`, deployed version **`0b36088`** (quotes + company profile + watermark) — owner ran `update.sh`, opened quotes, filled بيانات المنشأة, printed QT-0001 successfully.
- **Server:** Hetzner Cloud **CPX22** (2 vCPU / 4 GB), Ubuntu 24.04.5, kernel 6.8.0-151 (security updates applied and rebooted 2026-11-26; "0 updates" afterwards; do **not** run `do-release-upgrade`). IPv4 = what `platform.ngt.sa` resolves to (owner keeps it; not stored here). Server `.env` `DOMAIN=platform.ngt.sa`; the old `sslip.io` hostname no longer works. Deploy key (read-only) on GitHub; SSH key-only from the owner's Mac (use `ssh -o ServerAliveInterval=60 root@<IP>` to avoid idle disconnects); ufw (22/80/443); 2 GB swap; daily backup cron 03:00 → `/root/backups`. Containers `app`, `db` (healthy), `caddy` all up after reboot (restart policy `unless-stopped`).
- **Domain / DNS:** `ngt.sa` at **dnet** (SaudiNIC registrar), expires **2027-06-10**, name servers `pns01.t2.sa` / `pns02.t2.sa` (dnet-hosted DNS, editable in dnet → التحكم في DNS). Only record now: `A platform.ngt.sa → <server IPv4>` (TTL 3600). No MX (no domain email).
- **Data:** production contains only what the owner entered; all dev tests use a local database with fictional data.
- **Owner update procedure:**
  ```bash
  ssh -o ServerAliveInterval=60 root@<SERVER_IP>
  cd ~/admin-dashboard && bash scripts/update.sh
  ```
  (If already on the server — prompt shows `root@admin-dashboard` — run only the second line.)

---

## 10. Recommended next steps

1. **Push the deliverables commit** (after the owner's approval message), then the owner runs `update.sh` (includes a DB migration; takes a backup first). Then the owner checks Settings → Lists that «صدرت / معتمدة» shows «جاهزة للتسليم».
2. ~~Build تسليم المخرجات~~ **done in session 3** — original proposal kept for reference:
   - When a transaction reaches a DONE stage (or anytime), staff upload **outputs** (license, CR, certificate, letter…) — reuse `Document` storage/limits with a new owner type or a `Deliverable` model linked to `Transaction`.
   - Record **delivery**: recipient name, date/time, channel (WhatsApp / email / by hand / platform), notes, delivered-by user.
   - **"إرسال للعميل على واتساب"** button using `whatsappLink` with a prefilled MSA message (transaction title + TR number).
   - Page `/requests/deliverables`: transactions completed but **not yet delivered**, delivered log, filters (mine, overdue delivery).
   - **Printable delivery receipt (إيصال تسليم)** with signature lines and the NGT watermark style.
   - Show deliverables on the transaction page and the client page; dashboard "تحتاج إجراء" item for undelivered completed transactions.
3. **Administrative Affairs** (correspondence register with in/out numbering & attachments, archive search over all documents, assets & custody assigned to employees with handover/return, procurement requests & suppliers).
4. **Public Relations** (events, partnerships, campaigns/media calendar, customer satisfaction surveys — possibly a public survey link per client).
5. **Cross-cutting:** global search in the header (clients, companies, transactions, quotes, employees), in-app notifications bell, audit log, login rate limiting, session revocation on password change, Playwright E2E tests in the repo, `prisma.config.ts`, drop legacy `User.department`/`MANAGER`.
6. **Accounts (last):** invoices from quotes/transactions/contracts, payment plans, collections & aging, credit/debit notes, expenses, reports; then **native ZATCA Phase-2** (engine → sandbox compliance → owner onboarding with Fatoora OTP → go-live; keep historical invoices in Daftra).
7. **Hosting in Saudi Arabia (PDPL):** Google Cloud Dammam (`me-central2`, CST-licensed) — KSA customers buy through **CNTXT** with invoiced billing. Migration = same Docker Compose on a VM + `pg_dump`/restore + uploads copy + repoint the DNS A record at dnet.
8. **Google services** (owner request, unspecified): Google Workspace email on `ngt.sa` (add MX/SPF/DKIM at dnet), optional "Sign in with Google".
9. **Owner housekeeping:** make the repo private; replace the skyline photo with a licensed high-res image; change the dnet password; decide on leave-day counting, geofencing, GOSI rates; monthly `apt update && apt upgrade -y` (+ reboot when asked).
10. **Not implemented from the owner's reference mockups (need real features first):** global search bar, notifications bell, "remember me", Google login, self-registration.

---

*Conventions to keep:* formal Arabic UI · Gregorian `DateField` only · `requireSection(...)` in every action · new config/one-time data via AppMeta-guarded seed steps or AppMeta settings pages · never delete user data in migrations/seeds · light content inside `.card`, light text directly on the navy shell · no secrets/IPs/personal data in the repo · commit messages in Arabic with the session attribution trailer · each push needs the owner's explicit approval · after each push tell the owner exactly what to run on the server (in Egyptian Arabic, one command per block).
