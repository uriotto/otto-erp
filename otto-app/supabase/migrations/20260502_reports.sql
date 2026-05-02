-- Phase 6.4 — Reports table
create table reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  type text not null default 'monthly', -- monthly / yearly / custom
  period_start date not null,
  period_end date not null,
  title text not null,
  summary text,
  status text not null default 'draft', -- draft / pending_review / approved
  visible_to_client boolean not null default false,
  data jsonb default '{}',
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

alter table reports enable row level security;

create policy "tenant" on reports for all
  using (tenant_id = (select tenant_id from users where id = auth.uid()));
