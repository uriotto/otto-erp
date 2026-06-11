# Migrations

## Missing baseline (otto-2)

The core tables (customers, invoices, leads, tasks, time_entries, hour_banks, users, tenants, ...)
were created directly in Supabase Studio and have NO migration file in this repo.
If the Supabase project is ever lost, the schema cannot be rebuilt from code.

**Uri must run this once** (requires `supabase login` + project link):

```bash
cd otto-app
npx supabase login
npx supabase link --project-ref <PROJECT_REF>   # ref is in the Supabase dashboard URL
npx supabase db dump -f supabase/migrations/00000000000000_baseline.sql
```

Then commit the baseline file. From that point on, every schema change goes
through a migration file in this folder - never directly in Studio.

## Pending migrations (created 2026-06-11, NOT applied yet)

These files exist in the repo but have NOT been applied to the remote DB.
Apply them via the Supabase SQL editor or `npx supabase db push` (with Uri's approval):

- `20260611100000_booking_slots_insert_policy.sql` - replaces the wide-open public
  INSERT policy on `booking_slots` with a constrained one (active booking type,
  matching tenant, sane time range).
- `20260611100100_rate_limit_hits.sql` - table + `rate_limit_hit()` function used by
  `lib/rate-limit.ts`. The app fails open until this is applied (nothing breaks).
- `20260611100200_bot_tokens_revoked_at.sql` - adds `revoked_at` to `bot_api_tokens`
  so leaked bot tokens can be revoked. `authenticateBot` tolerates the column being
  missing until applied.
