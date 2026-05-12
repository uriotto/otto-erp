-- Active timers: one row per user representing a currently-running timer.
-- Shared between the OTTO UI and external clients (Telegram bot) so both
-- surfaces see the same live state. PK on user_id enforces "max one active
-- timer per user" - starting a new timer UPSERTs over the old row.

create table active_timers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  notes text,
  started_at timestamptz not null default now(),
  source text not null default 'web' check (source in ('web', 'telegram', 'api')),
  created_at timestamptz not null default now()
);

alter table active_timers enable row level security;

create policy "users see own active timer" on active_timers
  for all
  using (
    user_id = auth.uid()
    and tenant_id = (select tenant_id from users where id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and tenant_id = (select tenant_id from users where id = auth.uid())
  );

-- Realtime support so the UI can subscribe and react to changes made by the bot.
alter publication supabase_realtime add table active_timers;
