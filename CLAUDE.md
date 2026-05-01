# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

No test suite exists yet. Verify by running `build` + `typecheck`.

## Deploy

```bash
# from repo root (not otto-app/)
vercel deploy --prod
```

There is no GitHub remote. Vercel is triggered directly via CLI.

## Architecture

### Route groups

| Group      | Path                             | Purpose                           |
| ---------- | -------------------------------- | --------------------------------- |
| `(auth)`   | `/login`                         | Unauthenticated pages             |
| `(app)`    | `/dashboard`, `/customers`, etc. | Main admin app — requires session |
| `(portal)` | `/portal/…`                      | Read-only client-facing portal    |

`middleware.ts` calls `updateSession` (Supabase SSR) on every request to keep the JWT cookie fresh. Auth redirect logic lives in each layout, not in middleware.

### Data flow pattern

Every page follows this pattern:

- `page.tsx` — async Server Component, fetches data directly via `createClient()`, passes to a `*-list.tsx` or `*-detail.tsx` Client Component
- `actions.ts` — Server Actions for all mutations (no API routes for internal operations)
- `loading.tsx` — Suspense skeleton

### Supabase clients

- `lib/supabase/server.ts` — for Server Components and Server Actions (reads session from cookies)
- `lib/supabase/client.ts` — for Client Components only (browser)
- Never use the service role key client-side; it lives only in server contexts

### RLS is always on

Every table has `tenant_id`-based RLS. The helper functions `current_tenant_id()` and `current_user_role()` are used in policies. All Postgres trigger functions that run during INSERT/UPDATE must be `SECURITY DEFINER` — otherwise `auth.uid()` returns null in a Server Action context and RLS blocks the operation silently.

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
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY            # 32-byte hex — used for credentials vault AES-256
```

## Existing detailed instructions

`otto-app/CLAUDE.md` → `otto-docs/CLAUDE.md` contains the full coding standards, forbidden patterns, and phase task lists. This root file is a quick-start complement, not a replacement.
