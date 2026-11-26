# PROJECT HANDOFF — NGT Admin Dashboard (منصة NGT للاستشارات الإدارية)

> Repository: `NGT-C101/admin-dashboard` (GitHub — currently **public**; owner advised to make it private) · Branch: `main`
> Owner company: **شركة نصار جروب التجارية للاستشارات الإدارية** (Nassar Group Trading — NGT), Saudi Arabia
> Product: internal Arabic (RTL) management platform for a Saudi administrative-consulting firm
> (government-platform transactions, company formation, licenses, HR, etc.)
> Handoff written: 2026-11-26 · Last code commit before this document: `ca1c1bb`
> **Updated: 2026-11-26** — new navy/gold visual identity, Riyadh skyline login & home, custom domain `platform.ngt.sa` live (see §5, §9, §11).

---

## 0. TL;DR for the next developer

- **Stack:** Next.js 15 (App Router, Server Components + Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL 16 · Prisma 6 · Zod 4 · jose (JWT sessions) · bcryptjs · ExcelJS · lucide-react.
- **Runs in production** at **https://platform.ngt.sa** on one Hetzner VPS via Docker Compose (`db` Postgres + `app` Next.js standalone + `caddy` auto-HTTPS).
- **Visual identity:** dark navy shell + gold accents + NGT red primary buttons; light cards on dark background; Riyadh skyline photo on login and home banner (§5).
- **UI language:** formal Modern Standard Arabic (فصحى), RTL, Gregorian dates, Saudi time zone (`Asia/Riyadh`), SAR currency, Latin digits.
- **Done:** auth & granular permissions, Clients (full CRM), Transactions (معاملات), Employees/HR (profiles, leadership positions, org chart, leaves, attendance, payroll, performance), self-service ("خدماتي"), settings, branding, Excel import/export, printable reports.
- **Not built yet (placeholder pages):** Accounts/Finance (الحسابات), Administrative Affairs (الشؤون الإدارية), Public Relations (العلاقات العامة), Quotes & Deliverables inside Transactions.
- **Recommended next:** Accounts module (invoices/collections/expenses linked to transactions, contracts and payroll) — see §10.
- The owner is **non-technical** and communicates in **Egyptian Arabic**; explain steps in simple Arabic, and give copy-paste commands.

---

## 1. Architecture & folder structure

### 1.1 Runtime architecture

```
Browser ──HTTPS──► Caddy (ports 80/443, Let's Encrypt, domain from $DOMAIN)
                     │ reverse_proxy app:3000
                     ▼
                 Next.js standalone server (node server.js, TZ=Asia/Riyadh)
                   ├─ middleware.ts  → session-cookie gate (redirect to /login)
                   ├─ Server Components (pages)  → Prisma → PostgreSQL
                   ├─ Server Actions ("use server" files) → Prisma
                   ├─ Route handlers /api/*  (file download, Excel export, health)
                   └─ ./uploads (bind-mounted volume) ← uploaded documents
                 PostgreSQL 16 (named volume db-data)
```

- No separate backend: all business logic is in Server Components / Server Actions / `src/lib/*`.
- Container start command (Dockerfile): `npx prisma migrate deploy && node node_modules/tsx/dist/cli.mjs prisma/seed.ts && node server.js`
  → **migrations and idempotent seed run on every start/update.**

### 1.2 Folder structure

```
admin-dashboard/
├─ Dockerfile                 # 3-stage node:22-alpine build (deps → build → run), output: standalone, TZ=Asia/Riyadh
├─ docker-compose.yml         # db (postgres:16-alpine), app (build .), caddy (caddy:2-alpine); ./uploads bind mount
├─ Caddyfile                  # {$DOMAIN} { reverse_proxy app:3000 }
├─ deploy.env.example         # server .env template (DOMAIN, POSTGRES_*, SESSION_SECRET, ADMIN_*)
├─ .env.example               # local dev env template
├─ next.config.ts             # output standalone (unless STANDALONE=0), serverActions.bodySizeLimit = "11mb"
├─ scripts/
│  ├─ install.sh              # first-time server setup (apt upgrade, Docker, ufw, swap, .env generation, compose up, daily backup cron)
│  ├─ update.sh               # backup → git pull → docker compose up -d --build → image prune
│  ├─ backup.sh               # pg_dump → /root/backups/db-STAMP.sql.gz + tar uploads → files-STAMP.tar.gz (keeps 14 each)
│  └─ restore.sh              # restore db (+ matching files archive), asks "yes"
├─ prisma/
│  ├─ schema.prisma           # full data model (see §3)
│  ├─ migrations/             # 10 migrations (see §3.4)
│  ├─ seed.ts                 # idempotent seed + one-time data migrations guarded by AppMeta keys
│  └─ catalog.ts              # service catalog per government entity (from company profile PDF)
├─ public/
│  ├─ brand/logo-silver.png   # logo for dark backgrounds (sidebar, login panel)
│  ├─ brand/logo-red.png      # logo for light backgrounds (reports, payslips, login card)
│  ├─ brand/riyadh-skyline.webp # Riyadh skyline photo (login background, home banner) — supplied by owner, cropped to remove a third-party sign
│  └─ robots.txt              # Disallow: /  (internal system)
└─ src/
   ├─ middleware.ts           # auth gate; excludes _next, icons, /brand/, robots.txt, /api/health
   ├─ app/
   │  ├─ layout.tsx           # <html lang="ar" dir="rtl">, IBM Plex Sans Arabic + Noto Kufi Arabic fonts, metadata from BRAND, robots noindex
   │  ├─ globals.css          # Tailwind v4 @theme (brand palette), component classes, print rules
   │  ├─ icon.png / apple-icon.png  # favicon / touch icon (generated from red logo)
   │  ├─ login/               # page.tsx (split brand panel + form), actions.ts (login/logout)
   │  ├─ api/
   │  │  ├─ health/route.ts           # {ok:true}
   │  │  ├─ files/[id]/route.ts       # authorized document download/inline view
   │  │  └─ export/[kind]/route.ts    # Excel: clients | contracts | template | attendance | payroll
   │  └─ (dashboard)/                 # everything behind login, shares layout (Sidebar + header)
   │     ├─ layout.tsx                # requireUser({allowPasswordChange}), sidebar sections by permission, approvals badge
   │     ├─ page.tsx                  # home dashboard (stats filtered by permission, attendance widget)
   │     ├─ [section]/[sub]/page.tsx  # generic "قيد التطوير" placeholder for unbuilt sub-sections
   │     ├─ account/                  # حسابي: profile summary + change password (forced on first login)
   │     ├─ me/                       # خدماتي (employee self-service)
   │     ├─ clients/                  # CRM (directory, companies, contracts, communications, alerts, import, report)
   │     ├─ requests/                 # المعاملات (all, new, [id], tracking board)
   │     ├─ employees/                # HR (management, profiles, org-chart, attendance, leaves, performance, payroll)
   │     └─ settings/                 # users (accounts & permissions), lists (stages, services, entities)
   ├─ components/             # shared UI (see §5)
   │  └─ ui/                  # primitives: ActionForm, Field, PageHeader, Tabs, Badge, Collapsible, SearchBox, StageBadge, DateField, Skyline (SVG)
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
| `brand.ts` | BRAND name, short, tagline, slogan, company, logo paths — **single place to rename/rebrand** |
| `format.ts` | `formatSAR`, `formatDate`, `formatDateTime` (locale `ar-SA-u-nu-latn-ca-gregory`, TZ Asia/Riyadh), `txNumber` (TR-0001), `dateInputValue` |
| `forms.ts` | Zod helpers: `optionalText`, `tenDigits`, `optionalMoney`, `optionalInt`, `optionalDate`, `firstError`, `uniqueError` (Prisma P2002 → Arabic), `FormState` type |
| `time.ts` | Riyadh date helpers (UTC+3 fixed): `riyadhToday`, `dateKey`, `parseDateKey`, `riyadhHM`, `riyadhDateTime`, `isWeekend` (Fri/Sat), `monthBounds`, `currentMonthKey`, `minutesText`, `GREGORIAN_MONTHS`, `monthLabel` |
| `clients.ts` | client/contract/interaction labels & styles, `contractState`, `saudizationRate`, `whatsappLink`, `daysUntil`, `inDays`, `endOfToday`, **`daysText` (Arabic number agreement for days)** |
| `client-alerts.ts` | `getClientAlerts(scope)` — follow-ups, expiring documents & CRs (60d), ending contracts (30d) |
| `documents.ts` | doc type labels, limits (10 per client/company/employee, 5 per contract), `docTypesFor(owner)`, `documentOwner` |
| `storage.ts` | file save/read/delete in `UPLOAD_DIR` (default `./uploads`), magic-byte type detection (PDF/JPG/PNG/WEBP), 10 MB max, random hex keys |
| `excel.ts` | ExcelJS helpers: RTL sheet with brand header style, `xlsxResponse`, `cellText` |
| `import-columns.ts` | client import template columns & report type |
| `hr.ts` | HR labels, `serviceText`/`serviceParts`, `countText`, **end-of-service benefit** (Saudi Labor Law art. 84/85), Saudi **IBAN mod-97** validation/format, `totalWage`, `initials`, `PERM_LEVEL_LABELS` |
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
- Login (email + password), logout, 8-hour JWT session cookie (httpOnly, sameSite lax, secure in prod).
- Forced password change on first login for accounts created with a temporary password (`mustChangePassword`); user is redirected to `/account?first=1` until changed.
- "حسابي" page: profile summary, permissions summary, change password.
- Sidebar (dark maroon, silver logo): Home, **خدماتي** (if user has an employee profile), **تقييم أداء فريقي** (line managers without HR permission), **طلبات بانتظار موافقتي** (with count, when pending approvals exist), the 6 department sections filtered by permission, Settings (admin only). Mobile drawer.
- Home dashboard: stat cards (clients, companies, open/overdue/my transactions, client alerts, my due follow-ups, current staff, HR alerts, on leave today) filtered by permission; attendance check-in widget for employees; section quick links.
- Generic placeholder page for any sub-section not yet built.

### 2.2 Clients (العملاء) — CRM
- **Clients:** name, national ID/iqama (unique, 10 digits starting 1/2), phone(s) + WhatsApp link, email, nationality, city, status (LEAD/ACTIVE/INACTIVE), VIP, source, **account manager** (user), notes, archive (soft, managers only). Quick-create first company (name + CR) in the add-client form.
- **Client page (tabs):** overview (stats, info, edit, client alerts) · companies · documents · contracts · communications · transactions. Buttons: WhatsApp, new contract, new transaction, monthly report, archive.
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
- Sub-sections **عروض الأسعار** and **تسليم المخرجات** are placeholders (not built).

### 2.4 Employees / HR (الموظفين)
- **Employee profile** (EMP-0001): personal, identity (ID/iqama + expiry, passport + expiry), contact & emergency, job (title, department, direct manager, employment type, hire date, probation end, contract end, work location), salary (basic/housing/transport/other, bank, IBAN validated, GOSI flag), status (ACTIVE/ON_LEAVE/SUSPENDED/TERMINATED), termination (date + reason → **login auto-disabled**), reinstate, leave carryover.
- Create employee **with a login account + permission matrix in the same form** (admin only); or grant login later from the profile "access" tab.
- Profile tabs: personal · job (reports, status change, termination) · leaves & attendance · performance · salary & **end-of-service benefit (indicative)** · documents · access (admin).
- Directory (cards with avatar initials, position badge, access summary, service duration), HR alerts panel, filters.
- **Leadership positions (الإدارة والمناصب القيادية):** 13 default positions in 3 levels (Executive: CEO, GM; Senior: Admin Mgr, CFO, Operations Mgr; Department managers…), tree view, assign holder (auto-sets the holder's direct manager to the nearest filled position above; sets child-position holders' manager), add/edit/move/delete positions. Leadership appears first in the "direct manager" dropdown.
- **Org chart** built from `managerId`.
- **Leaves & permissions (الإجازات والأذونات):** leave types (annual, sick, unpaid, marriage, bereavement, paternity, maternity, hajj, exam, other) and hourly "استئذان"; working-day counting (Sun–Thu) excluding official holidays; overlap & balance checks; approval by direct manager or HR-MANAGE (never self); cancel; on-behalf requests (HR EDIT); tabs: pending for me, all, who's away, balances (carryover editable by MANAGE).
- **Attendance:** self check-in/out (server time), daily board (present/late/leave/absent/not yet), manual correction (audited: `source=MANUAL`, `editedById`, note), monthly report with commitment %, Excel export (summary + daily detail), work schedule & grace, official holidays (Founding Day 22 Feb, National Day 23 Sep seeded for 2 years; Eids added manually).
- **Payroll (مسير الرواتب):** monthly run DRAFT → APPROVED → PAID; auto-computed slips (pro-ration on 30-day basis, absence & unpaid-leave deduction, optional lateness deduction, GOSI employee share), manual overtime/bonus/other deduction preserved on recalculation; bank transfer Excel; printable payslip; employees see their approved slips in خدماتي. MANAGE only.
- **Performance reviews:** quarterly/half/annual; 7 criteria scored 1–5; auto metrics (transactions completed & on time, open/overdue now, attendance commitment, absences, lateness, leave days) snapshotted on submit; strengths/improvements/goals; DRAFT → SUBMITTED → ACKNOWLEDGED (employee comment); reopen (MANAGE); printable.

### 2.5 Self-service (خدماتي, `/me`)
Attendance widget · annual leave balance · leave/permission request form · my requests · pending performance review to acknowledge · my reviews · my payslips · my monthly attendance calendar.

### 2.6 Settings (admin only)
- **المستخدمون والصلاحيات:** all accounts with access summary; standalone account creation (not linked to an employee); per-user page: permission matrix, activate/deactivate, set temporary password.
- **القوائم والمراحل:** stages (order, kind, active), government entities, services grouped by entity (move between entities, deactivate).

### 2.7 Branding
Name "منصة NGT للاستشارات الإدارية", slogan "نطور شركات الغد", company "شركة نصار جروب التجارية"; logos extracted from the company profile PDF (silver & red); `BRAND.skyline` = skyline photo. Visual identity (navy/gold) chosen by the owner from reference mockups (see §5).

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

### 3.2 Models & relationships (key fields)
- **User**: email (unique), passwordHash (bcrypt 10 rounds), role, department (legacy, now null), active, mustChangePassword → `permissions[]`, `employee?` (1–1 via Employee.userId), managed clients, created/assigned transactions, events, documents uploaded, contracts created, interactions (creator/assignee), leave requests (creator/decider), attendance edits, payroll runs (creator/approver), reviews given.
- **Permission**: (userId, section) unique, level. Cascade on user delete.
- **Client** → companies[], documents[], contracts[], interactions[], accountManager (User?), archivedAt.
- **Company** → client (required), transactions[], documents[], contracts[], interactions[]; unique crNumber, unifiedNumber.
- **GovEntity** (unique name) → services[], transactions[]. **ServiceType** (unique [name, govEntityId]; null entity = general service).
- **Stage** (unique name, order, kind, active) → transactions, events.
- **Transaction** (number autoincrement unique) → company, serviceType?, govEntity?, stage, assignee (User?), createdBy, events[]; fee/govFees Decimal(12,2), dueDate.
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
- **AppMeta** (key/value) — config & one-time-migration flags.

### 3.3 AppMeta keys (configuration & one-time migrations)
| Key | Meaning |
|---|---|
| `catalog-v1` | service catalog sync done (seed.ts `syncCatalog`) |
| `permissions-v1` | legacy role/department → Permission rows migration done |
| `holidays-v1` | fixed Gregorian holidays seeded |
| `positions-v1` | default leadership positions seeded |
| `work-schedule` | JSON `{start, end, grace}` |
| `payroll-settings` | JSON `{gosiSaudiRate, gosiNonSaudiRate, gosiCap, deductAbsence, deductLate}` |

> Pattern: new one-time data changes go into `prisma/seed.ts` guarded by a new AppMeta key; seed runs at every container start and must stay idempotent and **non-destructive**.

### 3.4 Migrations (in order)
`init` → `clients_transactions` → `services_by_entity` → `documents` → `clients_crm` → `client_archive` → `employees_permissions` → `leaves_attendance` → `positions` → `payroll_performance`. None drop data (one dropped/re-created a unique index on ServiceType name).

### 3.5 Configuration / environment
Server `.env` (generated by `install.sh`, chmod 600, never committed): `DOMAIN`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
App env (compose): `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `UPLOAD_DIR=/app/uploads`; Dockerfile sets `NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 TZ=Asia/Riyadh`.
Local dev `.env`: `DATABASE_URL`, `SESSION_SECRET` (dev seed creates `admin@company.com` / `admin123` **only when NODE_ENV≠production**).
Optional: `INSECURE_COOKIES=1` (HTTP testing), `STANDALONE=0` (local `next start`).

---

## 4. Authentication & permissions

- **Session:** JWT `{userId}` signed HS256 with `SESSION_SECRET`, cookie `session`, 8h. `getCurrentUser()` re-reads the user each request → deactivation is immediate; password change does **not** revoke other existing sessions (JWT remains valid until expiry).
- **Middleware** only checks cookie validity (Edge); real authorization happens server-side in every page and action.
- **Model:** `isAdmin` (role ADMIN) = full access to everything incl. Settings and granting permissions. Otherwise per-section `Permission(level)`:

| Level | Meaning (enforced) |
|---|---|
| none | section hidden; URLs redirect to `/` |
| VIEW | read pages; add/edit UI hidden |
| EDIT | create/update records (clients, companies, contracts, interactions, documents upload, transactions, employee non-salary data, attendance correction, on-behalf leave requests, performance reviews) |
| MANAGE | EDIT + delete/archive/renew/cancel, employee **salaries, IBAN, documents, termination, payroll, carryover, positions, schedule/holidays**, reopen reviews |

- Helpers: `requireSection(slug, level)` in every action/page; `can(user, slug, level)` for UI gating.
- **Special rules:** line managers (employees with reports) can approve their team's leave and review their team **without** HR permission (`canDecide`, `canReview`); nobody approves/reviews themselves. Employee documents visible to HR-MANAGE or the employee. Payslip visible to HR-MANAGE or the employee after run approval. Granting logins/permissions = admin only. An admin cannot remove their own admin role.
- **Sensitive-data hiding for HR VIEW:** national ID, birth date, address, emergency contact, salary tab, documents tab.
- Passwords: min 10 chars for new/temporary passwords; bcrypt.

---

## 5. UI/UX design system & conventions

- **Language:** formal MSA everywhere in UI (no Egyptian colloquial). Error style: "يرجى …", "يجب …", "لا توجد …", "مسجّل مسبقاً". Arabic number agreement via `daysText` / `countText` (يوم واحد، يومان، 3 أيام، 15 يوماً). When "و" precedes a digit, a space is inserted (rendering issue).
- **Direction & locale:** RTL (`dir="rtl"`), fonts **IBM Plex Sans Arabic** (`font-sans`, UI/tables) and **Noto Kufi Arabic** (`font-display`, h1/h2 and big numbers) via next/font Google, Latin digits, Gregorian calendar, `Asia/Riyadh` time zone, SAR via `formatSAR`. Numbers/IDs/phones/IBAN rendered with `dir="ltr"`.
- **Palette** (`globals.css @theme`): `navy-50…950` (shell; `#070F24` darkest), `gold-100…700` (active/accent; `#D4A548` = 500), `brand-*` NGT red/maroon (`#B10302` = 600; primary button gradient), `chart-1` `#3559B5` / `chart-2` `#B07A12` (validated for contrast & color-blindness), `ivory`, `ink`. Semantic colors: emerald (ok/approved), amber (soon/pending), rose (expired/rejected), sky (info/leave), violet (holiday).
- **Dark shell mechanism:** the dashboard wrapper has class `.app-shell` (screen only — print stays white). Inside it the `--color-neutral-*` variables are **inverted** (light text on navy) and are **restored to light values** inside light containers (`.card`, `.input`, `.btn-secondary`, `[class~=bg-white]`, form fields). `text-brand-700/800` and `.link` switch to gold (`--link`) outside cards. So existing pages built with `.card` + neutral utilities work unchanged; new content placed directly on the background should use light text (`text-white`, `text-navy-100`) or `.card-dark`.
- **Component classes:** `.input`, `.btn-primary` (red gradient), `.btn-secondary`, `.btn-gold`, `.card` (white), `.card-dark` (navy glass), `.table`, `.link`, `.stat-value`, `.text-gold-gradient`.
- **Home dashboard** (`(dashboard)/page.tsx`): skyline banner + slogan + welcome, attendance widget, stat tiles (permission-filtered, colored icon tiles), recent transactions, `MonthlyChart` (new vs completed transactions per month, last 12 months, RTL time axis, hover titles + table view), completion-rate donut (done / (done + open)), my upcoming transactions, "تحتاج إجراء" list, section tiles. All figures come from real data.
- **Primitives:** `ActionForm` (useActionState; submits via `startTransition` so fields are **not cleared on validation errors**; resets on success unless `resetOnSuccess={false}`), `Field`/`FieldGrid`, `PageHeader` (breadcrumbs + actions), `Tabs` (URL `?tab=`), `Badge`, `Collapsible`, `SearchBox` (GET `?q=`), `StageBadge`, **`DateField`** (day select + Gregorian month names + typed year (accepts Arabic digits) → hidden `YYYY-MM-DD`; `withTime` → `YYYY-MM-DDTHH:MM`; custom validity blocks incomplete/invalid dates; resets on form reset) and `MonthField`. **No native `type="date"/"month"/"datetime-local"` inputs are used.**
- **Patterns:** list page → search/filters → table or cards; detail page with header card + tabs; edit forms inside `Collapsible`; printable pages use `print:hidden` and an A4 `<article>` with logo; Excel exports via plain `<a href="/api/export/...">` (eslint-disable for no-html-link).
- Mobile: responsive grids, sidebar drawer; verified no horizontal scroll at 390px on key pages.

---

## 6. Completed vs pending

### Completed (all pushed to `main`)
Phases: foundation → clients & transactions → server deployment → password page → branding → services by entity → documents → clients CRM batch 1 & 2 → formal Arabic → HR batch 1 (profiles + permission system) → HR batch 2 (leaves + attendance) → leadership positions + Gregorian date fields → HR batch 3 (payroll + performance) → **navy/gold visual identity + new home dashboard + skyline photo** → **custom domain `platform.ngt.sa`**.

### Pending (not started)
- **Accounts / Finance (الحسابات):** invoices (ZATCA-compliant VAT invoice with QR), collections/payments, expenses, financial reports — placeholders only.
- **Transactions:** quotes (عروض الأسعار) and deliverables (تسليم المخرجات).
- **Administrative Affairs (الشؤون الإدارية):** correspondence in/out, archive search, assets & custody, procurement & suppliers.
- **Public Relations (العلاقات العامة):** events, partnerships, campaigns, customer satisfaction surveys.
- Cross-cutting: notification center (email/SMS/WhatsApp), global search, role-based home dashboards, audit log.
- Open questions to the owner (unanswered): VAT registration & VAT number, e-invoicing method, how government fees are billed, payment patterns (installments/subscriptions), quote validity period.

---

## 7. Known bugs & unresolved issues

1. **Success message disappears** when a successful action re-renders the page and the form is replaced (e.g., grant login, approve request, terminate employee). Functional, UX only.
2. Permission-denied **server actions redirect to `/`** silently instead of showing an error (only reachable if UI gating is bypassed).
3. The "تمت المتابعة" (follow-up done) button is shown to VIEW-only users; the action then redirects home.
4. Password change does not invalidate other active sessions (JWT, 8h).
5. **No login rate limiting / lockout.**
6. Legacy fields `User.department` and role `MANAGER` remain in schema (unused after permissions-v1).
7. Employee profile computes **all** HR alerts then filters (inefficient at scale); annual balances table computes per employee sequentially.
8. Performance transaction metrics only work for employees **with a login** (transactions are assigned to `User`, not `Employee`).
9. Payroll simplifications: sick-leave pay tiers (Labor Law art. 117) not applied; employer GOSI share not tracked; GOSI rates are configurable defaults (9.75% Saudi / 0% non-Saudi, cap 45,000) — **must be verified**; lateness deduction off by default; 30-day basis.
10. Leave days are counted as **working days** (Sun–Thu) — owner has not confirmed vs calendar days. Annual balance is per calendar year; carryover is manual.
11. Attendance `trackingStart` = earliest attendance record company-wide (absences before it are ignored); **no geofencing** (employees can check in from anywhere) — owner not yet asked to decide.
12. Org-chart / positions tree is a long vertical list on large structures.
13. No automated test suite (verification was done with ad-hoc Playwright scripts outside the repo).
14. Lint warnings: unused `_f` (document-actions) and `_active` (auth) — harmless.
15. Prisma warns `package.json#prisma` is deprecated (move to `prisma.config.ts` before Prisma 7).
16. **Legal/compliance:** server is in **Germany (Hetzner Nuremberg)** while data includes Saudi national IDs and company records → Saudi **PDPL** data-residency concern raised with the owner; not resolved.
17. Security hygiene: SSH password login is **disabled** (key-only). Confirm with the owner that the initial platform admin password (generated by `install.sh`) has been changed via "حسابي", and rotate server credentials if in doubt.
18. `prisma migrate dev` fails in non-interactive shells when a change has warnings — workaround in §8.

---

## 8. Important technical decisions & dependencies

- **Server Actions over REST**; Zod validation in every action; Arabic error messages; Prisma unique errors mapped by `uniqueError`.
- **Timezone:** all date-only fields stored as `@db.Date` / UTC midnight of the Riyadh calendar day; times displayed with `timeZone: Asia/Riyadh`; containers run with `TZ=Asia/Riyadh`. **Run local dev with `TZ=Asia/Riyadh`.**
- **Files** stored on disk (`./uploads`, bind mount), type detected by magic bytes, served only through `/api/files/[id]` with permission checks, `nosniff`, `no-store`. Included in daily backups.
- **Docker image** = node:22-alpine **without extra apk packages** (Alpine already ships libssl3; Prisma target pinned). Standalone Next output + full node_modules copied (needed for `prisma migrate deploy` and `tsx` seed at start).
- **Idempotent seed** with AppMeta guards instead of data migrations in SQL.
- **Catalog sync** never deletes; retires old generic services by deactivation so historical transactions keep references.
- **Permissions** replaced role/department model (migration `permissions-v1`).
- **Positions** as a separate tree; assigning a holder updates `managerId` links.
- **Formal Arabic** is a product requirement; keep new text in MSA.
- **Dependencies:** next 15.5.29, react/react-dom 19.1.0, @prisma/client + prisma ^6.19.3, zod ^4, jose ^6, bcryptjs ^3, exceljs ^4.4.0, lucide-react, server-only; dev: tailwindcss ^4 + @tailwindcss/postcss, typescript ^5, eslint 9 + eslint-config-next, tsx.
- **Creating a migration non-interactively** (what was used):
  ```bash
  M=prisma/migrations/$(date -u +%Y%m%d%H%M%S)_name && mkdir -p $M
  npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
    --shadow-database-url "postgresql://USER:PASS@localhost:5432/shadow_tmp" --script > $M/migration.sql
  npx prisma migrate deploy && npx prisma generate
  ```
  Always inspect the SQL for `DROP` statements and **never commit an empty migration** (happened twice during development and was cleaned up).
- **Local dev quick start:** Postgres 16 running locally, `.env` with `DATABASE_URL` + `SESSION_SECRET`, then `npm ci && npx prisma migrate deploy && npm run db:seed && TZ=Asia/Riyadh npm run dev` (or `STANDALONE=0 npm run build && TZ=Asia/Riyadh npx next start`).

---

## 9. Exact current status

- **Code:** `main` at `76cd1a5` (+ this document update). Builds cleanly (`next build`), `tsc --noEmit` clean, eslint: 0 errors, 5 warnings (unused directives/vars, harmless).
- **Production server:** Hetzner Cloud **CPX22** (2 vCPU / 4 GB), Ubuntu 24.04 (kernel 6.8.0-151, security updates applied 2026-11-26), Nuremberg, IPv4 = what `platform.ngt.sa` resolves to (owner keeps it; not stored in this public repo). URL **https://platform.ngt.sa** (server `.env` `DOMAIN=platform.ngt.sa`; the old `sslip.io` hostname no longer works). Deploy key (read-only) on the GitHub repo; SSH key-only access from the owner's Mac; ufw (22/80/443); 2 GB swap; daily backup cron at 03:00 to `/root/backups`.
- **Deployed version:** `76cd1a5` (navy/gold identity + skyline photo) — owner ran `update.sh` and confirmed the site works on the new domain (2026-11-26).
- **Domain / DNS:** `ngt.sa` registered at **dnet** (SaudiNIC registrar), expires 2027-06-10, name servers `pns01.t2.sa` / `pns02.t2.sa` (dnet DNS). Record: `A platform.ngt.sa → <server IPv4>` (TTL 3600). Hostinger mail records (MX/SPF/DKIM/verification TXT) that the owner did not create were **removed** — the company currently has **no email on the domain**. Owner was advised to change the dnet password and ask dnet support who added them.
- **Data:** production contains only what the owner entered; all screenshots/tests were done on a local dev database with fictional data.
- **Update procedure (owner):**
  ```bash
  ssh root@<SERVER_IP>
  cd ~/admin-dashboard && bash scripts/update.sh
  ```

---

## 10. Recommended next steps

1. **Confirm production is on the latest commit** and that the admin password was changed; enter real positions, salaries, IBANs, work schedule, and Eid holidays.
2. **Get owner decisions:** working vs calendar leave days; geofenced attendance; GOSI rates; late-deduction policy; VAT registration/number & invoicing approach; PDPL hosting decision (consider migrating to a Saudi-region provider using the same Docker setup).
3. **Build Accounts (الحسابات):**
   - Invoices from transactions / contracts (office fee taxable 15% VAT; government fees as non-taxable pass-through line), numbering, ZATCA Phase-1 simplified QR (TLV base64) at minimum; Phase-2 (Fatoora API) as a later project.
   - Collections/payments (partial payments, receivables aging), expenses (categories, attachments, link payroll runs as salary expense), financial reports (P&L, receivables, per-client profitability), Excel export.
4. **Finish Transactions:** quotes (create → send/print → accept → auto-create transaction) and deliverables (upload outputs, mark delivered, notify client).
5. **Administrative Affairs & PR** modules (§6).
6. **Platform hardening:** login rate limiting, session revocation on password change, notification channel (email/WhatsApp) for approvals & expiries, audit log, assign transactions to employees without logins (or require logins), automated tests (Playwright E2E for critical flows), move Prisma config to `prisma.config.ts`, drop legacy `User.department` / `MANAGER` after verification.
7. ~~Custom domain~~ — done (`platform.ngt.sa`).
8. **Hosting in Saudi Arabia (PDPL):** owner is interested in Google Cloud. Google Cloud's Dammam region (`me-central2`) is CST-licensed; KSA customers must purchase through **CNTXT** with invoiced billing. Migration = same Docker Compose on a VM + `pg_dump`/restore + uploads copy + repoint the DNS A record.
9. **Google services** (owner request, not yet specified): company email via Google Workspace on `ngt.sa` (needs MX/SPF/DKIM records at dnet), and optionally "Sign in with Google".
10. **Not implemented from the owner's reference mockups:** global search bar, notifications bell, "remember me", Google login, self-registration — need real features before adding UI.

---

*Conventions to keep:* formal Arabic UI · Gregorian `DateField` only · `requireSection(...)` in every action · new config/one-time data via AppMeta-guarded seed steps · never delete user data in migrations/seeds · commit messages in Arabic with the session attribution trailer · tell the owner exactly what to run on the server after each push.
