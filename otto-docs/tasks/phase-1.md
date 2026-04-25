# Phase 1 — תשתית

> **משך מתוכנן**: 3 שבועות
> **מטרה**: תשתית מלאה — Next.js, Supabase, Auth, RLS, PWA, Design System, Monitoring. בסוף Phase 1 יש מערכת ריקה אבל פעילה שאפשר להיכנס אליה.

## עקרונות עבודה ל-Phase זה

- כל משימה תקבל branch נפרד
- אחרי כל משימה — commit + עצירה לאישור אורי
- בדיקה של RTL בכל קומפוננטה שנוצרת
- בדיקה של RLS לפני כל push

## משימות

### 1.1 הקמת Repo + Next.js project

**Branch**: `phase-1.1-init`

- [ ] יצירת Next.js 16 project עם TypeScript Strict, App Router, Tailwind
- [ ] עדכון `tsconfig.json` ל-strict mode מלא
- [ ] התקנת shadcn/ui עם RTL support
- [ ] הוספת `tailwindcss-rtl` plugin
- [ ] עדכון `app/layout.tsx` עם `<html lang="he" dir="rtl">`
- [ ] הוספת Assistant + Caveat fonts מ-`next/font/google`
- [ ] עדכון `tailwind.config.ts` לפי DESIGN.md (כל הצבעים, fonts, sizes)
- [ ] יצירת `globals.css` עם CSS variables של הצבעים
- [ ] יצירת דף בית פשוט שמוודא RTL עובד
- [ ] התקנת ESLint + Prettier + Husky pre-commit
- [ ] קובץ `.env.example` ראשוני

**Acceptance**: דף בית בעברית RTL נטען, fonts נטענים נכון.

---

### 1.2 הקמת Supabase + DB Schema ראשוני

**Branch**: `phase-1.2-supabase`

- [ ] יצירת Supabase project (אורי עושה ידנית, מוסר credentials)
- [ ] התקנת Supabase CLI
- [ ] `supabase init` בתיקיית הפרויקט
- [ ] חיבור ל-project הרחוק
- [ ] יצירת migration ראשונה: `tenants`, `users` (extension של auth.users)
- [ ] יצירת helper functions: `auth.tenant_id()`, `auth.user_role()`, `auth.customer_id()`
- [ ] הפעלת RLS על שתי הטבלאות
- [ ] policies בסיסיות
- [ ] יצירת tenant ראשון: "OTTO" עם slug='otto'
- [ ] יצירת admin user ראשון: אורי
- [ ] התקנת `@supabase/supabase-js` + `@supabase/ssr`
- [ ] יצירת `lib/supabase/client.ts` ו-`lib/supabase/server.ts`
- [ ] הרצת `gen types typescript` → `lib/supabase/types.ts`

**Acceptance**: אפשר ליצור Supabase client ב-Server Component ולשלוף את ה-tenant.

---

### 1.3 Authentication

**Branch**: `phase-1.3-auth`

- [ ] עדכון Supabase Auth settings: Email + Magic Link מופעלים
- [ ] הגדרת Google OAuth (אורי מספק credentials)
- [ ] יצירת `app/(auth)/login/page.tsx` עם UI לפי DESIGN.md
- [ ] יצירת Server Action `signInWithEmail` (Magic Link)
- [ ] יצירת Server Action `signInWithGoogle` (OAuth)
- [ ] יצירת `app/(auth)/callback/route.ts` ל-OAuth callback
- [ ] יצירת `app/(auth)/signout/route.ts`
- [ ] middleware ב-`middleware.ts` שבודק auth + מעביר ל-login אם לא מחובר
- [ ] middleware קובע `tenant_id` ב-JWT
- [ ] middleware קובע `role` ב-JWT
- [ ] יצירת `app/(app)/dashboard/page.tsx` ריק שדורש auth
- [ ] בדיקה: login → redirect ל-dashboard

**Acceptance**: אורי יכול להתחבר עם Magic Link ועם Google, מגיע ל-dashboard.

---

### 1.4 Layout + Sidebar

**Branch**: `phase-1.4-layout`

- [ ] יצירת `app/(app)/layout.tsx` — wrapper עם Sidebar + main
- [ ] יצירת `components/layout/sidebar.tsx` לפי המוקאפ:
  - Logo: OTTO + dot
  - Tagline: "אוטומציות לעצלנים" ב-Caveat
  - 4 sections: ראשי, עבודה, כסף ומסמכים, חכם
  - Nav items עם icons מ-Lucide
  - Active state ל-route הנוכחי
  - Badges לconters (פלייסהולדר עם 0)
- [ ] יצירת `components/layout/header.tsx`:
  - Greeting דינמי (בוקר טוב / צהריים טובים / ערב טוב)
  - Sub-greeting ב-Caveat
  - Timer pill (פלייסהולדר)
  - Icon buttons (settings, search)
- [ ] Mobile responsive — Sidebar הופך ל-Sheet מתחת ל-900px
- [ ] בדיקת RTL — אייקונים directional עם `rtl:rotate-180`

**Acceptance**: ה-layout נראה כמו המוקאפ, mobile עובד, ניווט בין pages עובד.

---

### 1.5 Design System Components (shadcn primitives)

**Branch**: `phase-1.5-ui-primitives`

התקנה והתאמה של shadcn/ui primitives:

- [ ] Button — 4 variants לפי DESIGN.md
- [ ] Input — עם dir="auto"
- [ ] Card — לפי המפרט
- [ ] Badge / Chip
- [ ] Avatar (square + circle variants)
- [ ] Progress Bar
- [ ] Sheet (drawer)
- [ ] Dialog
- [ ] Toast (sonner) — בעברית, RTL
- [ ] DropdownMenu
- [ ] Select
- [ ] Tabs
- [ ] Table
- [ ] Tooltip
- [ ] Skeleton

לכל אחד: בדיקה ב-Storybook או דף `/components-demo` (development only).

**Acceptance**: יש דף `/components-demo` שמראה את כל הרכיבים בעברית, RTL נכון.

---

### 1.6 PWA Setup

**Branch**: `phase-1.6-pwa`

- [ ] התקנת `next-pwa` או `serwist`
- [ ] יצירת `public/manifest.json`:
  - name: OTTO
  - short_name: OTTO
  - lang: he
  - dir: rtl
  - theme_color: navy
  - background_color: cream
  - display: standalone
  - start_url: /dashboard
  - icons: 192x192, 512x512 (לבנות עם logo navy על cream)
- [ ] Service Worker עם cache strategies
- [ ] Splash screens ל-iOS
- [ ] Push Notifications setup:
  - VAPID keys
  - Service Worker handlers
  - Server Action `subscribeToPush`
- [ ] בדיקה: install מחיבור Mobile Chrome
- [ ] בדיקה: install מחיבור Desktop Chrome
- [ ] בדיקה: Push notification מתקבלת

**Acceptance**: אפשר להתקין את OTTO כ-app, מתקבלות התרעות.

---

### 1.7 Sentry Setup

**Branch**: `phase-1.7-sentry`

- [ ] התקנת `@sentry/nextjs`
- [ ] `sentry.client.config.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts`
- [ ] DSN ב-env vars
- [ ] Release tracking
- [ ] Source maps upload
- [ ] בדיקה: error מועבר ל-Sentry

**Acceptance**: זריקת error יזומה מופיעה ב-Sentry dashboard.

---

### 1.8 UptimeRobot Setup

**Branch**: `phase-1.8-uptime`

(אורי עושה ידנית, אבל Claude Code יכין:)

- [ ] יצירת endpoint `/api/health`:
  - בודק חיבור ל-Supabase
  - מחזיר 200 + `{status: 'ok'}`
- [ ] תיעוד ב-`docs/monitoring.md`:
  - URL ל-UptimeRobot
  - תדירות check: כל 5 דקות
  - Alert contacts: SMS + Email
- [ ] אורי מגדיר ב-UptimeRobot

**Acceptance**: UptimeRobot מבצע ping ל-`/api/health` כל 5 דקות.

---

### 1.9 GitHub Actions — Maintenance Bot Skeleton

**Branch**: `phase-1.9-maintenance-bot`

- [ ] יצירת `.github/workflows/ci.yml` — tests + lint על PR
- [ ] יצירת `.github/workflows/deploy.yml` — Vercel deployment (optional, אם לא Vercel auto)
- [ ] יצירת `.github/workflows/maintenance-bot.yml`:
  - Cron: יום ראשון 8:00 בבוקר ישראל
  - Steps:
    - Checkout
    - Setup Node
    - `npm outdated --json` → file
    - שליחה ל-Claude API עם prompt לניתוח
    - יצירת PR עם הצעות עדכון
    - שליחת מייל סיכום לאורי
- [ ] יצירת prompt template ל-Claude ב-`.github/maintenance-prompt.md`
- [ ] Secret: `ANTHROPIC_API_KEY` ב-GitHub Actions

**Acceptance**: workflow רץ ידנית בהצלחה (`workflow_dispatch`).

---

### 1.10 Vercel Deployment

**Branch**: `phase-1.10-vercel`

- [ ] חיבור Vercel project ל-GitHub
- [ ] קביעת domains:
  - `app.otto-ai.co.il` → main app
  - `clients.otto-ai.co.il` → portal (לא בנוי, redirect ל-soon page)
- [ ] env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server only)
  - `NEXT_PUBLIC_APP_URL`
  - `SENTRY_DSN`
  - וכו'
- [ ] בדיקה: deployment נכשל אם RLS לא מופעל (custom check)
- [ ] בדיקה: production build עובד
- [ ] בדיקה: routes עובדים בdomain האמיתי
- [ ] בדיקה: cookies work cross-subdomain

**Acceptance**: `https://app.otto-ai.co.il` נטען, login עובד.

---

### 1.11 בדיקת מקיף לסיום Phase 1

- [ ] בדיקה: Auth flow מלא (login, logout, session persistence)
- [ ] בדיקה: כל הדפים נטענים בלי errors
- [ ] בדיקה: RTL במובייל ובדסקטופ
- [ ] בדיקה: PWA install על iPhone + Android + Desktop
- [ ] בדיקה: Sentry קולט errors
- [ ] בדיקה: UptimeRobot ירוק
- [ ] עדכון `DECISIONS.md` עם החלטות חדשות שהתקבלו במהלך Phase 1
- [ ] עדכון `CLAUDE.md` עם דברים שנלמדו (אם יש)
- [ ] תיוג git: `v0.1.0-phase-1-complete`

**Acceptance**: אורי יכול להיכנס ל-app, לראות layout ריק, להתקין כ-PWA.

---

## Risks & Watch-outs ל-Phase זה

⚠ **RTL ב-shadcn/ui** — חלק מהרכיבים דורשים תיקונים נוספים, לא רק plugin
⚠ **PWA ב-iOS** — מצומצם יותר מ-Android, לבדוק היטב
⚠ **Magic Link callbacks** — צריך URL נכון ב-Supabase settings
⚠ **JWT custom claims** — `tenant_id` ו-`role` צריכים להגיע ל-JWT (דרך Postgres function)

---

## מה הלאה?

Phase 1 → Phase 2 (Core CRM): לקוחות, לידים, אנשי קשר, WhatsApp integration.
