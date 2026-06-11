# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Obsidian Vault

**לפני כל עבודה:** קרא את הtopic file הרלוונטי ב-`~/obsidian-engineering/vault/`.
**אחרי כל סשן משמעותי:** הוסף session log entry לtopic file המתאים.

- `vault/Meeting Notes/` — topic file לכל מודול (overview + session log)
- `vault/Architecture/` — ארכיטקטורה, lib/, components/
- `vault/Integrations/` — Google Calendar, Make, Zoom, Sentry

## Current Modules

All modules live under `otto-app/app/(app)/`. Status as of May 2026:

| Module        | Path                | Notes                                                            |
| ------------- | ------------------- | ---------------------------------------------------------------- |
| Dashboard     | `/dashboard`        | KPIs, activity feed, tasks — Suspense streaming                  |
| Customers     | `/customers`        | List + 360 profile, activities, tags                             |
| Leads         | `/leads`            | Kanban pipeline, lead scoring, convert to customer               |
| Contacts      | `/contacts`         | Contact management                                               |
| Projects      | `/projects`         | Project tracking                                                 |
| Tasks         | `/tasks`            | Kanban/list/calendar, subtasks                                   |
| Calendar      | `/calendar`         | Week/day/month/list, Google Calendar sync (OAuth, push webhook)  |
| Time Tracking | `/time`             | Timer in header (Zustand + localStorage + `active_timers` table) |
| Hour Banks    | `/hour-banks`       | FIFO allocation, alerts, renewal drafts — logic in Postgres      |
| Invoices      | `/invoices`         | Document types, payment recording, webhooks to Make              |
| Recordings    | `/recordings`       | Zoom webhook, ivrit-ai transcription, Claude summary             |
| Settings      | `/settings`         | Profile, tenant, Google Calendar OAuth, bot tokens               |
| Portal        | `/portal/[token]`   | Read-only client-facing (magic link)                             |
| Proposals     | `/proposal/[token]` | Public, no auth, UUID token                                      |

## Repository layout

```
otto-erp-crm/
├── otto-app/     # Next.js 16 application (the only deployable unit)
└── otto-docs/    # Planning docs: PRD, DESIGN, DATA_MODEL, DECISIONS, tasks/phase-N.md
```

All code work happens inside `otto-app/`. The docs are read-only reference — never edit them unless asked.

## Commands (all run from `otto-app/`)

```bash
npm run dev          # local dev server — http://localhost:3000
npm run build        # production build (runs before every deploy)
npm run typecheck    # tsc --noEmit (run after any TS change)
npm run lint         # eslint
npm run format       # prettier --write .
```

E2E tests exist: `npx playwright test` (or `npm run test:e2e`) from `otto-app/`. Specs live in `otto-app/tests/e2e/`, config in `otto-app/playwright.config.ts`. Also verify with `build` + `typecheck`. No unit test suite yet.

## Deploy

**GitHub remote:** `https://github.com/uriotto/otto-erp` (origin/main)

Two options:

1. `git push origin main` — pushes to GitHub; Vercel auto-deploys if connected
2. `vercel deploy --prod` from repo root — direct CLI deploy

> **⚠ Never push or deploy without explicit approval.** Finish the code changes, report they're ready, and wait for Uri to say "deploy" / "פרוס" / "push".

## Architecture

### Route groups

| Group      | Path                             | Purpose                                        |
| ---------- | -------------------------------- | ---------------------------------------------- |
| `(auth)`   | `/login`                         | Unauthenticated pages                          |
| `(app)`    | `/dashboard`, `/customers`, etc. | Main admin app — requires session              |
| `(portal)` | `/portal/…`                      | Read-only client-facing portal (magic link)    |
| `(public)` | `/proposal/[token]`              | Fully public — no auth, accessed by UUID token |

`middleware.ts` (`lib/supabase/middleware.ts`) calls `updateSession` on every request. Public routes are whitelisted explicitly (`isPublicProposal`, `isPublicApi`, `isPublicRoot`) — everything else redirects to `/login` if unauthenticated. To add a new public route, add an `isPublic*` check and include it in the admin redirect guard.

The `(public)` layout must NOT contain `<html>` or `<body>` — those belong only in the root layout. The public layout is a transparent wrapper (`<>{children}</>`).

### Data flow pattern

Every page follows this pattern:

- `page.tsx` — async Server Component, fetches data directly via `createClient()`, passes to a `*-list.tsx` or `*-detail.tsx` Client Component
- `actions.ts` — Server Actions for all mutations (no API routes for internal operations)
- `loading.tsx` — Suspense skeleton

### Supabase clients

- `lib/supabase/server.ts` — for Server Components and Server Actions (reads session from cookies)
- `lib/supabase/client.ts` — for Client Components only (browser)
- Service role client (`createClient` with `SUPABASE_SERVICE_ROLE_KEY`) — only in server contexts for operations that need to bypass RLS (e.g. signing a proposal as an unauthenticated user). For read operations on public routes, prefer `NEXT_PUBLIC_SUPABASE_ANON_KEY` + a permissive RLS SELECT policy — it works in local dev without the service role key.

### RLS is always on

Every table has `tenant_id`-based RLS. The helper functions `current_tenant_id()` and `current_user_role()` are used in policies. All Postgres trigger functions that run during INSERT/UPDATE must be `SECURITY DEFINER` — otherwise `auth.uid()` returns null in a Server Action context and RLS blocks the operation silently.

### Public token pattern (proposals)

The `quotes` table has a `public_token UUID` column (generated by default, unique). This token is the sole auth mechanism for the public proposal URL — no session required. The RLS SELECT policy allows `anon` access when `public_token IS NOT NULL`. The admin copies the link via the UI; the token is never shown in the admin table.

### Shared UI components

`components/ui/` holds reusable primitives built for this project (not shadcn):

- `BulkActionBar` — fixed bottom bar for multi-select bulk actions, used across all list views
- `ViewToggle` — icon button group that persists view selection in `localStorage`
- `Toast` / `useToast` — toast notifications
- `Spinner`, `Skeleton`, `ExportCsvButton`

### Notifications

The `NotificationBell` in the header polls `/api/notifications` every 60 s. Notifications are created by Postgres functions (`check_bank_alerts`, `process_expired_hour_banks`) — both are `SECURITY DEFINER` and insert with an explicit `user_id` (looked up as the first admin for the tenant).

### Timer

Persistent timer state lives in a Zustand store (`lib/stores/timer.ts`) backed by `localStorage`. The `<Timer>` component in the header renders it. On stop it creates a `time_entry`, which triggers `tg_allocate_on_insert` to allocate hours to the active hour bank and call `check_bank_alerts`.

### Hour Banks allocation

Critical logic lives entirely in Postgres:

- `allocate_time_entry_to_bank(entry_id)` — FIFO bank selection, 3 cases: no bank / sufficient / split
- `check_bank_alerts(bank_id)` — fires threshold alerts and creates renewal drafts
- Both are `SECURITY DEFINER`; the trigger `tg_allocate_on_insert` fires after every `time_entries` INSERT

### Make webhook

`lib/make-webhook.ts` fires a POST to the tenant's configured webhook URL (stored in `tenant_settings.make_webhook_url`) for events like `hour_bank.renewed` and `hour_bank.created`.

### External bot API

External bots (Telegram, etc.) call `/api/bot/*` routes with a long-lived bearer token instead of session cookies.

- **Auth + rate-limit guard**: `lib/bot-auth.ts` — `guardBotRequest(request)` is the canonical entry point for every bot route. It authenticates the bearer token (SHA-256 lookup in `bot_api_tokens`, rejects revoked tokens) AND rate-limits (per token + per IP, via `lib/rate-limit.ts`, fail-open until the `rate_limit_hits` migration is applied). Returns `{ ok: true, auth }` or `{ ok: false, response }`.
- **Live timer state**: the `active_timers` table holds one row per running user. The web `<Timer>` component hydrates from it on mount and subscribes via Realtime, so a bot starting/stopping a timer is mirrored in the header pill within seconds.
- **Token management UI**: `/settings/bot-tokens` — generates a token (shown once), labels it, and revokes when compromised. Plaintext is never stored, only the SHA-256 hash.
- **Tenant scoping (MANDATORY)**: the service-role client bypasses RLS, so a single forgotten `.eq("tenant_id", ...)` leaks all tenants' data. New bot routes MUST use `botScopedClient(auth)` from `lib/bot-auth.ts` instead of `createServiceClient()` directly — it pre-filters every select/update/delete by the token's tenant and injects `tenant_id` on insert. Reference examples: `app/api/bot/customers/route.ts`, `app/api/bot/leads/route.ts`, `app/api/bot/search/route.ts`, `app/api/bot/invoices/route.ts`. If a query genuinely cannot go through it (e.g. a table without `tenant_id`), add an explicit comment explaining how tenant isolation is preserved.

To add a new bot endpoint:

1. Create `app/api/bot/<name>/route.ts`
2. Call `guardBotRequest(request)` first; if `!guard.ok` return `guard.response`
3. Use `botScopedClient(guard.auth)` for all DB access (see MANDATORY rule above)
4. No middleware change needed — `/api/bot/` is already in `isPublicApi`

### Security patterns (mandatory templates for new APIs)

When adding any new API route or webhook, copy the pattern from these existing routes — they are the reference implementations:

- **Cron auth (shared secret, constant-time)**: `app/api/cron/monthly-invoices/route.ts` — `CRON_SECRET` + `timingSafeEqual`
- **Webhook auth (HMAC signature)**: `lib/recordings/transcription.ts` — `RECORDINGS_WEBHOOK_SECRET`
- **Bearer-token auth (hashed at rest)**: `lib/bot-auth.ts` — SHA-256 token hash, revocation check, rate limiting
- **Secrets encryption**: AES-256-GCM (credentials vault); **input validation**: Zod schema on every request body/query

Never weaken these: no plaintext tokens in DB, no string-compare on secrets, no unvalidated input, no secrets in code or logs.

### Sharing business logic between server actions and API routes

Server Actions (`"use server"`) can only export async functions with serializable parameters — they can't accept a `SupabaseClient`. When the same business logic needs to run both as a cookie-authenticated action AND as a token-authenticated API route, extract the core logic into a plain module under `lib/`, then call it from both surfaces.

Example: `lib/time-entries.ts` exports `createTimeEntryFromTimerForUser(supabase, userId, tenantId, input)`. The server action in `app/(app)/time/actions.ts` calls it with a cookie-bound client; the `/api/bot/timer/stop` route calls it with a service-role client. Identical DB writes, identical triggers fire, zero duplication.

### Google Calendar integration

`lib/google-calendar.ts` — full OAuth + sync library. Key exports:

- `getAccessToken(tenantId)` — reads `tenant_settings`, refreshes token if expiring in <5 min
- `createGoogleEvent / updateGoogleEvent / deleteGoogleEvent` — outbound sync called from `calendar/actions.ts` (fire-and-forget, errors logged but never surface to user)
- `fetchIncrementalChanges(tenantId)` — used by the push webhook to pull incremental updates
- `registerPushChannel / cancelPushChannel` — 7-day Google push channel lifecycle
- `upsertGoogleEventsToOtto(tenantId, changes)` — writes inbound Google events to the `events` table; uses `last-modified wins` conflict resolution

**OAuth flow:** `app/api/auth/google-calendar/route.ts` → Google → `app/api/auth/google-calendar/callback/route.ts` — stores encrypted tokens in `tenant_settings` and calls `registerPushChannel`.

**Inbound push webhook:** `app/api/calendar/sync/route.ts` — receives `POST` from Google; validates `X-Goog-Channel-ID` against DB before processing. This route is in `isPublicApi` in middleware (Google has no session cookie).

**Token storage:** encrypted with AES-256 using `ENCRYPTION_KEY`. Fields: `google_refresh_token`, `google_access_token`, `google_token_expiry`, `google_calendar_id`, `google_sync_token`, `google_channel_id`, `google_channel_resource_id` on `tenant_settings`.

### Webhook routes and middleware whitelist

External webhooks (Zoom, Google, etc.) arrive without a session cookie — middleware will redirect them to `/login` (307) unless whitelisted. To add a new external webhook:

1. Create the route under `app/api/`
2. Add `pathname.startsWith("/api/your-route")` to the `isPublicApi` check in `lib/supabase/middleware.ts`
3. Validate the request inside the handler (signature, channel ID, etc.) — never trust unvalidated webhook payloads

External-auth API routes (bearer token instead of webhook signature) follow the same pattern — see `/api/bot/*` and `lib/bot-auth.ts`.

### Calendar view layout

The week and day views in `app/(app)/calendar/calendar-client.tsx` use **absolute positioning** for timed events:

- `HOUR_PX = 56` — pixel height of each hour slot (fixed, not dynamic)
- Each day column is `position: relative` with `height: 24 * HOUR_PX`
- Events are absolutely placed: `top = (startH + startMin/60) * HOUR_PX`, `height = durationH * HOUR_PX`
- `EventBlock` component renders timed events (fills height, shows time range); `EventChip` is for month-view and all-day slots only

## Key conventions

- **RTL everywhere**: use `ms-*`/`me-*`, `ps-*`/`pe-*`, `text-start`/`text-end` — never `ml-*`/`mr-*`
- **Hebrew UI text**, English identifiers (variables, functions, DB columns)
- **Palette**: `bg-cream-paper`, `text-navy`, `text-ink-soft`, `text-ink-faded`, `border-ink-line` — defined in `globals.css`
- **No `any`** in TypeScript; use `unknown` + narrowing
- `'use client'` only when state/effects/browser APIs are required; default to Server Components
- Supabase types are auto-generated at `lib/supabase/types.ts` — regenerate after schema changes

## Environment variables (required in `.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # required for write operations on public routes (signing)
ENCRYPTION_KEY                 # 32-byte hex — used for credentials vault AES-256

# Google Calendar integration
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_APP_URL            # e.g. https://app.otto-ai.co.il — used as OAuth redirect base and webhook base
```

## Existing detailed instructions

`otto-app/CLAUDE.md` → `otto-docs/CLAUDE.md` contains the full coding standards, forbidden patterns, and phase task lists. This root file is a quick-start complement, not a replacement.
