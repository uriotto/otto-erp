-- Migration: booking_types + booking_slots
-- Phase 5.1 — Booking Links

create table booking_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  duration_minutes integer not null default 60,
  is_active boolean not null default true,
  color text not null default 'navy',
  created_at timestamptz not null default now(),
  unique(tenant_id, slug)
);

alter table booking_types enable row level security;

-- קריאה ציבורית לפי slug (לדף הbooking — anon)
create policy "public read active booking types" on booking_types
  for select using (is_active = true);

-- כתיבה מוגבלת לטנאנט
create policy "tenant write booking types" on booking_types
  for all
  using (tenant_id = (select tenant_id from users where id = auth.uid()));

create table booking_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  booking_type_id uuid not null references booking_types(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  notes text,
  status text not null default 'confirmed', -- confirmed / cancelled
  created_at timestamptz not null default now()
);

alter table booking_slots enable row level security;

-- admin רואה את כל ה-slots של הטנאנט שלו
create policy "tenant read booking slots" on booking_slots
  for select
  using (tenant_id = (select tenant_id from users where id = auth.uid()));

create policy "tenant write booking slots" on booking_slots
  for all
  using (tenant_id = (select tenant_id from users where id = auth.uid()));

-- גישה ציבורית ליצירת slot (booking חדש — anon)
create policy "public insert booking slots" on booking_slots
  for insert with check (true);
