create table if not exists recordings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  duration_seconds integer,
  storage_path text,
  file_size bigint,
  status text not null default 'uploaded',
  transcript text,
  summary text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table recordings enable row level security;

create policy "tenant" on recordings for all
  using (tenant_id = (select tenant_id from users where id = auth.uid()));
