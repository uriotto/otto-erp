-- Phase 6.2: External Agents Hub
-- Creates external_agents and agent_invocations tables

create table external_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  webhook_url text not null,
  trigger_contexts text[] not null default '{}',
  icon text not null default 'Sparkles',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table agent_invocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references external_agents(id) on delete cascade,
  context_type text not null,
  context_id uuid not null,
  status text not null default 'pending',
  result_html text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table external_agents enable row level security;
alter table agent_invocations enable row level security;

create policy "tenant isolation" on external_agents
  for all using (tenant_id = (select tenant_id from users where id = auth.uid()));

create policy "tenant isolation" on agent_invocations
  for all using (tenant_id = (select tenant_id from users where id = auth.uid()));
