-- Migration: events table for calendar
-- Phase 5.1 — Calendar Integration

create table events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  type text not null default 'meeting', -- meeting / call / deadline / other
  google_event_id text, -- for future Google Calendar sync
  created_at timestamptz not null default now()
);

alter table events enable row level security;

create policy "tenant isolation on events" on events for all
  using (tenant_id = (select tenant_id from users where id = auth.uid()));
