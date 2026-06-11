-- 00000000000000_baseline.sql
-- OTTO-erp baseline schema snapshot (audit otto-2).
-- Generated 2026-06-11 from the live otto-erp Supabase project via MCP.
-- Captures the core schema that pre-dated the migrations folder so the DB is
-- recoverable from source. Dependency-safe top-to-bottom order.
-- NOTE: recovery baseline, NOT auto-applied (objects already exist live).
-- RLS policies are NOT reproduced here as runnable CREATE POLICY (they live in
-- the app's later migrations / are documented in the audit); this file restores
-- structure: extensions, types, tables, constraints, indexes, functions,
-- triggers, views, and RLS-enable flags.


-- ===== EXTENSIONS =====

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;


-- ===== ENUM TYPES =====

CREATE TYPE content_platform AS ENUM ('linkedin', 'instagram', 'facebook', 'twitter', 'blog', 'email', 'whatsapp', 'other');
CREATE TYPE content_status AS ENUM ('idea', 'planned', 'in_progress', 'published', 'cancelled');
CREATE TYPE document_type AS ENUM ('contract', 'spec', 'deliverable', 'reference', 'other');
CREATE TYPE file_source AS ENUM ('storage', 'drive');
CREATE TYPE hour_bank_status AS ENUM ('draft', 'active', 'depleted', 'expired', 'cancelled');
CREATE TYPE invoice_document_type AS ENUM ('payment_request', 'tax_invoice', 'tax_invoice_receipt', 'receipt');
CREATE TYPE invoice_status AS ENUM ('draft', 'pending_review', 'sent', 'partial', 'paid', 'overdue', 'cancelled');
CREATE TYPE invoice_type AS ENUM ('advance', 'monthly_hours', 'project', 'expense', 'overage', 'other');
CREATE TYPE notification_severity AS ENUM ('info', 'warning', 'critical', 'success');
CREATE TYPE payment_method AS ENUM ('bank_transfer', 'credit_card', 'bit', 'cash', 'check', 'other');
CREATE TYPE project_billing_model AS ENUM ('hourly', 'hour_bank', 'fixed_price', 'retainer');
CREATE TYPE project_health AS ENUM ('on_track', 'at_risk', 'off_track');
CREATE TYPE project_phase AS ENUM ('discovery', 'specification', 'development', 'qa', 'launch', 'maintenance');
CREATE TYPE project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done', 'cancelled');
CREATE TYPE time_entry_billing_status AS ENUM ('pending', 'allocated_to_bank', 'overage', 'invoiced', 'cancelled');


-- ===== TABLES (columns) =====

CREATE TABLE active_timers (
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  customer_id uuid,
  project_id uuid,
  task_id uuid,
  notes text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'web'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid,
  lead_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  due_at timestamp with time zone,
  completed_at timestamp with time zone,
  end_at timestamp with time zone
);

CREATE TABLE agent_invocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  context_type text NOT NULL,
  context_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  result_html text,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

CREATE TABLE booking_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  booking_type_id uuid NOT NULL,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone NOT NULL,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text,
  notes text,
  status text NOT NULL DEFAULT 'confirmed'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE booking_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  color text NOT NULL DEFAULT 'navy'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE bot_api_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  token_hash text NOT NULL,
  label text,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone
);

CREATE TABLE contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE customer_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  label text NOT NULL,
  credential_type text NOT NULL DEFAULT 'password'::text,
  username text,
  url text,
  secret_encrypted text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  website text,
  address text,
  status text NOT NULL DEFAULT 'active'::text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  billing_model_default text DEFAULT 'hourly'::text,
  hourly_rate_override numeric(8,2),
  retainer_monthly_amount numeric,
  portal_enabled boolean NOT NULL DEFAULT false,
  portal_last_login timestamp with time zone,
  active boolean NOT NULL DEFAULT true,
  company_registration_number text
);

CREATE TABLE documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid,
  project_id uuid,
  created_by uuid,
  type document_type NOT NULL DEFAULT 'other'::document_type,
  title text NOT NULL,
  file_url text,
  file_path text,
  file_source file_source NOT NULL DEFAULT 'storage'::file_source,
  file_size_bytes bigint,
  mime_type text,
  signature_required boolean NOT NULL DEFAULT false,
  signed_at timestamp with time zone,
  signed_by_name text,
  signed_by_email text,
  signature_data text,
  visible_to_client boolean NOT NULL DEFAULT false,
  extracted_text text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE event_guests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  email text NOT NULL,
  name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid,
  project_id uuid,
  title text NOT NULL,
  description text,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  location text,
  type text NOT NULL DEFAULT 'meeting'::text,
  google_event_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  meeting_url text
);

CREATE TABLE expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid,
  project_id uuid,
  category text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ILS'::text,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  reimbursable boolean NOT NULL DEFAULT false,
  invoiced boolean NOT NULL DEFAULT false,
  invoice_id uuid,
  receipt_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE external_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  webhook_url text NOT NULL,
  trigger_contexts text[] NOT NULL DEFAULT '{}'::text[],
  icon text NOT NULL DEFAULT 'Sparkles'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE hour_banks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  purchased_hours numeric(6,2) NOT NULL,
  hourly_rate numeric(8,2) NOT NULL,
  total_amount numeric(10,2) DEFAULT (purchased_hours * hourly_rate),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  status hour_bank_status NOT NULL DEFAULT 'active'::hour_bank_status,
  parent_bank_id uuid,
  absorbed_overage_hours numeric(6,2) NOT NULL DEFAULT 0,
  alert_threshold_pct integer NOT NULL DEFAULT 30,
  alert_threshold_hours numeric(4,2) NOT NULL DEFAULT 3.00,
  alert_sent_pct boolean NOT NULL DEFAULT false,
  alert_sent_hours boolean NOT NULL DEFAULT false,
  notes text,
  invoice_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  description text NOT NULL,
  quantity numeric(8,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) DEFAULT round((quantity * unit_price), 2),
  order_index integer NOT NULL DEFAULT 0
);

CREATE TABLE invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  project_id uuid,
  hour_bank_id uuid,
  number text,
  type invoice_type NOT NULL DEFAULT 'other'::invoice_type,
  status invoice_status NOT NULL DEFAULT 'draft'::invoice_status,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  paid_at timestamp with time zone,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 18,
  tax_amount numeric(12,2) DEFAULT round(((subtotal * tax_rate) / (100)::numeric), 2),
  total_amount numeric(12,2) DEFAULT round((subtotal + ((subtotal * tax_rate) / (100)::numeric)), 2),
  currency text NOT NULL DEFAULT 'ILS'::text,
  finbot_invoice_id text,
  finbot_url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  document_type invoice_document_type
);

CREATE TABLE leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  source text,
  status text NOT NULL DEFAULT 'new'::text,
  value numeric(12,2),
  notes text,
  assigned_to uuid,
  converted_to_customer_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tags text[] NOT NULL DEFAULT '{}'::text[]
);

CREATE TABLE marketing_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_by uuid,
  title text NOT NULL,
  body text,
  platform content_platform NOT NULL DEFAULT 'linkedin'::content_platform,
  status content_status NOT NULL DEFAULT 'idea'::content_status,
  scheduled_date date,
  published_at timestamp with time zone,
  tags text[] DEFAULT '{}'::text[],
  utm_source text,
  utm_medium text,
  utm_campaign text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  due_date date,
  completed_at timestamp with time zone,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  severity notification_severity NOT NULL DEFAULT 'info'::notification_severity,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  method payment_method NOT NULL DEFAULT 'bank_transfer'::payment_method,
  reference text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  card_last_4 text
);

CREATE TABLE project_payment_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'pending'::text,
  paid_at date,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE project_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  default_billing_model project_billing_model,
  default_estimated_hours numeric(6,2),
  tasks_template jsonb NOT NULL DEFAULT '[]'::jsonb,
  phases_template jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid,
  parent_project_id uuid,
  name text NOT NULL,
  description text,
  status project_status NOT NULL DEFAULT 'planning'::project_status,
  phase project_phase,
  billing_model project_billing_model NOT NULL DEFAULT 'hourly'::project_billing_model,
  budget numeric(10,2),
  estimated_hours numeric(6,2),
  start_date date,
  due_date date,
  completed_at timestamp with time zone,
  google_drive_folder_id text,
  template_id uuid,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  health project_health NOT NULL DEFAULT 'on_track'::project_health,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  warranty_start date,
  warranty_end date
);

CREATE TABLE quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  project_id uuid,
  title text NOT NULL,
  amount numeric(12,2),
  status text NOT NULL DEFAULT 'draft'::text,
  document_url text,
  notes text,
  valid_until date,
  signed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  modules jsonb DEFAULT '[]'::jsonb,
  signature_data text,
  signer_name text,
  signer_email text
);

CREATE TABLE rate_limit_hits (
  key text NOT NULL,
  window_start timestamp with time zone NOT NULL,
  hits integer NOT NULL DEFAULT 0
);

CREATE TABLE recordings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid,
  project_id uuid,
  title text NOT NULL,
  duration_seconds integer,
  storage_path text,
  file_size bigint,
  status text NOT NULL DEFAULT 'uploaded'::text,
  transcript text,
  summary text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  lead_id uuid,
  vault_processed_at timestamp with time zone,
  vault_retry_count integer NOT NULL DEFAULT 0
);

CREATE TABLE reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  customer_id uuid,
  type text NOT NULL DEFAULT 'monthly'::text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  title text NOT NULL,
  summary text,
  status text NOT NULL DEFAULT 'draft'::text,
  visible_to_client boolean NOT NULL DEFAULT false,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_at timestamp with time zone
);

CREATE TABLE tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  project_id uuid,
  parent_task_id uuid,
  title text NOT NULL,
  description text,
  status task_status NOT NULL DEFAULT 'todo'::task_status,
  priority task_priority NOT NULL DEFAULT 'medium'::task_priority,
  assigned_to uuid,
  due_date date,
  completed_at timestamp with time zone,
  recurring_config jsonb,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  customer_id uuid,
  lead_id uuid,
  due_at timestamp with time zone,
  portal_hidden boolean NOT NULL DEFAULT false,
  created_via_portal boolean NOT NULL DEFAULT false
);

CREATE TABLE tenant_settings (
  tenant_id uuid NOT NULL,
  default_hourly_rate numeric(8,2) NOT NULL DEFAULT 400.00,
  default_alert_threshold_pct integer NOT NULL DEFAULT 30,
  default_alert_threshold_hours numeric(4,2) NOT NULL DEFAULT 3.00,
  auto_absorb_overage_default boolean NOT NULL DEFAULT true,
  default_hour_bank_expiry_months integer NOT NULL DEFAULT 12,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  make_webhook_url text,
  default_hour_bank_rate numeric(8,2) NOT NULL DEFAULT 450.00,
  google_refresh_token text,
  google_access_token text,
  google_token_expiry timestamp with time zone,
  google_calendar_id text DEFAULT 'primary'::text,
  google_sync_token text,
  google_channel_id text,
  google_channel_resource_id text
);

CREATE TABLE tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  plan text NOT NULL DEFAULT 'free'::text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  customer_id uuid,
  task_id uuid,
  project_id uuid,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  duration_minutes integer NOT NULL,
  billable boolean NOT NULL DEFAULT true,
  billing_status time_entry_billing_status NOT NULL DEFAULT 'pending'::time_entry_billing_status,
  hourly_rate_at_entry numeric(8,2),
  notes text,
  imported_from_toggl boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  consumed_from_bank_id uuid,
  is_overage boolean NOT NULL DEFAULT false,
  invoice_id uuid
);

CREATE TABLE user_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'team'::text,
  invited_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  used_at timestamp with time zone
);

CREATE TABLE users (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'team'::text,
  customer_id uuid,
  avatar_url text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);


-- ===== CONSTRAINTS (PK, UNIQUE, CHECK, FK) =====

ALTER TABLE active_timers ADD CONSTRAINT active_timers_pkey PRIMARY KEY (user_id);
ALTER TABLE activities ADD CONSTRAINT activities_pkey PRIMARY KEY (id);
ALTER TABLE agent_invocations ADD CONSTRAINT agent_invocations_pkey PRIMARY KEY (id);
ALTER TABLE booking_slots ADD CONSTRAINT booking_slots_pkey PRIMARY KEY (id);
ALTER TABLE booking_types ADD CONSTRAINT booking_types_pkey PRIMARY KEY (id);
ALTER TABLE bot_api_tokens ADD CONSTRAINT bot_api_tokens_pkey PRIMARY KEY (id);
ALTER TABLE contacts ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);
ALTER TABLE customer_credentials ADD CONSTRAINT customer_credentials_pkey PRIMARY KEY (id);
ALTER TABLE customers ADD CONSTRAINT customers_pkey PRIMARY KEY (id);
ALTER TABLE documents ADD CONSTRAINT documents_pkey PRIMARY KEY (id);
ALTER TABLE event_guests ADD CONSTRAINT event_guests_pkey PRIMARY KEY (id);
ALTER TABLE events ADD CONSTRAINT events_pkey PRIMARY KEY (id);
ALTER TABLE expenses ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);
ALTER TABLE external_agents ADD CONSTRAINT external_agents_pkey PRIMARY KEY (id);
ALTER TABLE hour_banks ADD CONSTRAINT hour_banks_pkey PRIMARY KEY (id);
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);
ALTER TABLE invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
ALTER TABLE leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE marketing_content ADD CONSTRAINT marketing_content_pkey PRIMARY KEY (id);
ALTER TABLE milestones ADD CONSTRAINT milestones_pkey PRIMARY KEY (id);
ALTER TABLE notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE project_payment_schedule ADD CONSTRAINT project_payment_schedule_pkey PRIMARY KEY (id);
ALTER TABLE project_templates ADD CONSTRAINT project_templates_pkey PRIMARY KEY (id);
ALTER TABLE projects ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
ALTER TABLE quotes ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);
ALTER TABLE rate_limit_hits ADD CONSTRAINT rate_limit_hits_pkey PRIMARY KEY (key, window_start);
ALTER TABLE recordings ADD CONSTRAINT recordings_pkey PRIMARY KEY (id);
ALTER TABLE reports ADD CONSTRAINT reports_pkey PRIMARY KEY (id);
ALTER TABLE tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
ALTER TABLE tenant_settings ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (tenant_id);
ALTER TABLE tenants ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);
ALTER TABLE time_entries ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);
ALTER TABLE user_invites ADD CONSTRAINT user_invites_pkey PRIMARY KEY (id);
ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE booking_types ADD CONSTRAINT booking_types_tenant_id_slug_key UNIQUE (tenant_id, slug);
ALTER TABLE bot_api_tokens ADD CONSTRAINT bot_api_tokens_token_hash_key UNIQUE (token_hash);
ALTER TABLE quotes ADD CONSTRAINT quotes_public_token_key UNIQUE (public_token);
ALTER TABLE tenants ADD CONSTRAINT tenants_slug_key UNIQUE (slug);
ALTER TABLE user_invites ADD CONSTRAINT user_invites_tenant_id_email_key UNIQUE (tenant_id, email);
ALTER TABLE users ADD CONSTRAINT users_email_per_tenant UNIQUE (tenant_id, email);
ALTER TABLE active_timers ADD CONSTRAINT active_timers_source_check CHECK ((source = ANY (ARRAY['web'::text, 'telegram'::text, 'api'::text])));
ALTER TABLE activities ADD CONSTRAINT activities_at_most_one_target CHECK ((NOT ((customer_id IS NOT NULL) AND (lead_id IS NOT NULL))));
ALTER TABLE activities ADD CONSTRAINT activities_type_check CHECK ((type = ANY (ARRAY['call'::text, 'email'::text, 'whatsapp'::text, 'meeting'::text, 'note'::text, 'task'::text])));
ALTER TABLE customer_credentials ADD CONSTRAINT customer_credentials_credential_type_check CHECK ((credential_type = ANY (ARRAY['password'::text, 'api_key'::text, 'oauth'::text, 'ssh'::text, 'other'::text])));
ALTER TABLE customers ADD CONSTRAINT customers_billing_model_default_check CHECK ((billing_model_default = ANY (ARRAY['hourly'::text, 'hour_bank'::text, 'fixed_price'::text, 'retainer'::text])));
ALTER TABLE customers ADD CONSTRAINT customers_retainer_monthly_amount_check CHECK ((retainer_monthly_amount > (0)::numeric));
ALTER TABLE customers ADD CONSTRAINT customers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text])));
ALTER TABLE expenses ADD CONSTRAINT expenses_amount_check CHECK ((amount > (0)::numeric));
ALTER TABLE hour_banks ADD CONSTRAINT hour_banks_alert_threshold_pct_check CHECK (((alert_threshold_pct >= 0) AND (alert_threshold_pct <= 100)));
ALTER TABLE hour_banks ADD CONSTRAINT hour_banks_hourly_rate_check CHECK ((hourly_rate > (0)::numeric));
ALTER TABLE hour_banks ADD CONSTRAINT hour_banks_purchased_hours_check CHECK ((purchased_hours > (0)::numeric));
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'qualified'::text, 'proposal'::text, 'won'::text, 'lost'::text])));
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric));
ALTER TABLE payments ADD CONSTRAINT payments_card_last_4_format CHECK (((card_last_4 IS NULL) OR (card_last_4 ~ '^[0-9]{4}$'::text)));
ALTER TABLE project_payment_schedule ADD CONSTRAINT project_payment_schedule_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text])));
ALTER TABLE projects ADD CONSTRAINT projects_no_self_parent CHECK (((parent_project_id IS NULL) OR (parent_project_id <> id)));
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'signed'::text, 'rejected'::text, 'expired'::text])));
ALTER TABLE tenants ADD CONSTRAINT tenants_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'business'::text])));
ALTER TABLE time_entries ADD CONSTRAINT time_entries_end_after_start CHECK ((end_time > start_time));
ALTER TABLE time_entries ADD CONSTRAINT time_entries_positive_duration CHECK ((duration_minutes > 0));
ALTER TABLE user_invites ADD CONSTRAINT user_invites_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'team'::text, 'viewer'::text])));
ALTER TABLE users ADD CONSTRAINT users_client_has_customer CHECK (((role <> 'client'::text) OR (customer_id IS NOT NULL)));
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'team'::text, 'client'::text])));
ALTER TABLE active_timers ADD CONSTRAINT active_timers_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE active_timers ADD CONSTRAINT active_timers_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE active_timers ADD CONSTRAINT active_timers_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE active_timers ADD CONSTRAINT active_timers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE active_timers ADD CONSTRAINT active_timers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE activities ADD CONSTRAINT activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE activities ADD CONSTRAINT activities_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE activities ADD CONSTRAINT activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE activities ADD CONSTRAINT activities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE agent_invocations ADD CONSTRAINT agent_invocations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES external_agents(id) ON DELETE CASCADE;
ALTER TABLE agent_invocations ADD CONSTRAINT agent_invocations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE booking_slots ADD CONSTRAINT booking_slots_booking_type_id_fkey FOREIGN KEY (booking_type_id) REFERENCES booking_types(id) ON DELETE CASCADE;
ALTER TABLE booking_slots ADD CONSTRAINT booking_slots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE booking_types ADD CONSTRAINT booking_types_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE bot_api_tokens ADD CONSTRAINT bot_api_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE bot_api_tokens ADD CONSTRAINT bot_api_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE contacts ADD CONSTRAINT contacts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE customer_credentials ADD CONSTRAINT customer_credentials_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE customer_credentials ADD CONSTRAINT customer_credentials_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE customers ADD CONSTRAINT customers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE documents ADD CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE documents ADD CONSTRAINT documents_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE documents ADD CONSTRAINT documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE documents ADD CONSTRAINT documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE event_guests ADD CONSTRAINT event_guests_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE event_guests ADD CONSTRAINT event_guests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE events ADD CONSTRAINT events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE events ADD CONSTRAINT events_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE events ADD CONSTRAINT events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD CONSTRAINT expenses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD CONSTRAINT expenses_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD CONSTRAINT expenses_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD CONSTRAINT expenses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE external_agents ADD CONSTRAINT external_agents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE hour_banks ADD CONSTRAINT hour_banks_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE hour_banks ADD CONSTRAINT hour_banks_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
ALTER TABLE hour_banks ADD CONSTRAINT hour_banks_parent_bank_id_fkey FOREIGN KEY (parent_bank_id) REFERENCES hour_banks(id) ON DELETE SET NULL;
ALTER TABLE hour_banks ADD CONSTRAINT hour_banks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
ALTER TABLE invoices ADD CONSTRAINT invoices_hour_bank_id_fkey FOREIGN KEY (hour_bank_id) REFERENCES hour_banks(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD CONSTRAINT invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD CONSTRAINT invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE leads ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE leads ADD CONSTRAINT leads_converted_to_customer_id_fkey FOREIGN KEY (converted_to_customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE leads ADD CONSTRAINT leads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE marketing_content ADD CONSTRAINT marketing_content_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE marketing_content ADD CONSTRAINT marketing_content_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE milestones ADD CONSTRAINT milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE milestones ADD CONSTRAINT milestones_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE payments ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payments ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE payments ADD CONSTRAINT payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE project_payment_schedule ADD CONSTRAINT project_payment_schedule_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE project_payment_schedule ADD CONSTRAINT project_payment_schedule_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE project_templates ADD CONSTRAINT project_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE projects ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE projects ADD CONSTRAINT projects_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE projects ADD CONSTRAINT projects_parent_project_id_fkey FOREIGN KEY (parent_project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE projects ADD CONSTRAINT projects_template_id_fkey FOREIGN KEY (template_id) REFERENCES project_templates(id) ON DELETE SET NULL;
ALTER TABLE projects ADD CONSTRAINT projects_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE quotes ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE quotes ADD CONSTRAINT quotes_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE quotes ADD CONSTRAINT quotes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE recordings ADD CONSTRAINT recordings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE recordings ADD CONSTRAINT recordings_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE recordings ADD CONSTRAINT recordings_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE recordings ADD CONSTRAINT recordings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE reports ADD CONSTRAINT reports_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE reports ADD CONSTRAINT reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD CONSTRAINT tasks_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD CONSTRAINT tasks_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD CONSTRAINT tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD CONSTRAINT tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE tenant_settings ADD CONSTRAINT tenant_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE time_entries ADD CONSTRAINT time_entries_consumed_from_bank_id_fkey FOREIGN KEY (consumed_from_bank_id) REFERENCES hour_banks(id) ON DELETE SET NULL;
ALTER TABLE time_entries ADD CONSTRAINT time_entries_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE time_entries ADD CONSTRAINT time_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE time_entries ADD CONSTRAINT time_entries_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE time_entries ADD CONSTRAINT time_entries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE time_entries ADD CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE user_invites ADD CONSTRAINT user_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id);
ALTER TABLE user_invites ADD CONSTRAINT user_invites_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE users ADD CONSTRAINT users_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE users ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;


-- ===== INDEXES =====

CREATE INDEX activities_customer_idx ON public.activities USING btree (customer_id, occurred_at DESC) WHERE (customer_id IS NOT NULL);
CREATE INDEX activities_due_idx ON public.activities USING btree (tenant_id, due_at) WHERE ((due_at IS NOT NULL) AND (completed_at IS NULL));
CREATE INDEX activities_lead_idx ON public.activities USING btree (lead_id, occurred_at DESC) WHERE (lead_id IS NOT NULL);
CREATE INDEX activities_tenant_idx ON public.activities USING btree (tenant_id, occurred_at DESC);
CREATE INDEX bot_api_tokens_user_idx ON public.bot_api_tokens USING btree (user_id);
CREATE INDEX contacts_customer_id_idx ON public.contacts USING btree (customer_id);
CREATE INDEX contacts_tenant_id_idx ON public.contacts USING btree (tenant_id);
CREATE INDEX customers_active_idx ON public.customers USING btree (tenant_id, active);
CREATE INDEX expenses_tenant_date_idx ON public.expenses USING btree (tenant_id, occurred_on DESC);
CREATE INDEX hour_banks_customer_active_idx ON public.hour_banks USING btree (customer_id) WHERE (status = 'active'::hour_bank_status);
CREATE INDEX hour_banks_expiry_idx ON public.hour_banks USING btree (expiry_date) WHERE ((status = 'active'::hour_bank_status) AND (expiry_date IS NOT NULL));
CREATE INDEX idx_credentials_customer ON public.customer_credentials USING btree (customer_id);
CREATE INDEX idx_documents_customer ON public.documents USING btree (customer_id);
CREATE INDEX idx_documents_fts ON public.documents USING gin (to_tsvector('simple'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(extracted_text, ''::text))));
CREATE INDEX idx_documents_project ON public.documents USING btree (project_id);
CREATE INDEX idx_documents_tags ON public.documents USING gin (tags);
CREATE INDEX idx_documents_tenant ON public.documents USING btree (tenant_id);
CREATE INDEX idx_documents_type ON public.documents USING btree (type);
CREATE INDEX idx_event_guests_event_id ON public.event_guests USING btree (event_id);
CREATE INDEX idx_pps_project ON public.project_payment_schedule USING btree (project_id);
CREATE INDEX idx_quotes_tenant_customer ON public.quotes USING btree (tenant_id, customer_id);
CREATE INDEX idx_quotes_tenant_project ON public.quotes USING btree (tenant_id, project_id);
CREATE INDEX invoice_items_invoice_idx ON public.invoice_items USING btree (invoice_id, order_index);
CREATE INDEX invoices_customer_idx ON public.invoices USING btree (customer_id);
CREATE INDEX invoices_due_date_open_idx ON public.invoices USING btree (due_date) WHERE (status = ANY (ARRAY['sent'::invoice_status, 'partial'::invoice_status, 'overdue'::invoice_status]));
CREATE INDEX invoices_tenant_status_idx ON public.invoices USING btree (tenant_id, status);
CREATE INDEX marketing_content_tenant_id_scheduled_date_idx ON public.marketing_content USING btree (tenant_id, scheduled_date);
CREATE INDEX marketing_content_tenant_id_status_idx ON public.marketing_content USING btree (tenant_id, status);
CREATE INDEX milestones_project_order_idx ON public.milestones USING btree (project_id, order_index);
CREATE INDEX notifications_tenant_unread_idx ON public.notifications USING btree (tenant_id, read_at, created_at DESC);
CREATE INDEX payments_invoice_idx ON public.payments USING btree (invoice_id, paid_at DESC);
CREATE INDEX project_templates_tenant_idx ON public.project_templates USING btree (tenant_id);
CREATE INDEX projects_customer_status_idx ON public.projects USING btree (customer_id, status) WHERE (deleted_at IS NULL);
CREATE INDEX projects_parent_idx ON public.projects USING btree (parent_project_id) WHERE (parent_project_id IS NOT NULL);
CREATE INDEX projects_tags_gin_idx ON public.projects USING gin (tags);
CREATE INDEX projects_tenant_status_due_idx ON public.projects USING btree (tenant_id, status, due_date) WHERE (deleted_at IS NULL);
CREATE INDEX tasks_customer_id_idx ON public.tasks USING btree (customer_id) WHERE (customer_id IS NOT NULL);
CREATE INDEX tasks_due_at_open_idx ON public.tasks USING btree (due_at) WHERE (status <> ALL (ARRAY['done'::task_status, 'cancelled'::task_status]));
CREATE INDEX tasks_due_date_open_idx ON public.tasks USING btree (due_date) WHERE (status <> ALL (ARRAY['done'::task_status, 'cancelled'::task_status]));
CREATE INDEX tasks_lead_id_idx ON public.tasks USING btree (lead_id) WHERE (lead_id IS NOT NULL);
CREATE INDEX tasks_project_status_order_idx ON public.tasks USING btree (project_id, status, order_index);
CREATE INDEX tasks_tags_gin_idx ON public.tasks USING gin (tags);
CREATE INDEX tasks_tenant_assigned_status_idx ON public.tasks USING btree (tenant_id, assigned_to, status);
CREATE INDEX time_entries_consumed_bank_idx ON public.time_entries USING btree (consumed_from_bank_id) WHERE (consumed_from_bank_id IS NOT NULL);
CREATE INDEX time_entries_customer_start_idx ON public.time_entries USING btree (customer_id, start_time DESC);
CREATE INDEX time_entries_overage_idx ON public.time_entries USING btree (customer_id, billing_status) WHERE ((is_overage = true) AND (billing_status = 'overage'::time_entry_billing_status));
CREATE INDEX time_entries_project_start_idx ON public.time_entries USING btree (project_id, start_time DESC);
CREATE INDEX time_entries_tenant_user_start_idx ON public.time_entries USING btree (tenant_id, user_id, start_time DESC);
CREATE INDEX users_customer_idx ON public.users USING btree (customer_id) WHERE (role = 'client'::text);
CREATE INDEX users_tenant_role_idx ON public.users USING btree (tenant_id, role);
CREATE UNIQUE INDEX quotes_public_token_idx ON public.quotes USING btree (public_token);


-- ===== FUNCTIONS =====

CREATE OR REPLACE FUNCTION public.allocate_time_entry_to_bank(p_entry_id uuid)
 RETURNS TABLE(entry_id uuid, status time_entry_billing_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_entry record;
  v_bank record;
  v_remaining_minutes numeric;
  v_consumed_minutes numeric;
  v_overage_id uuid;
  v_split_end timestamptz;
  v_rate numeric(8,2);
  v_target_bank_id uuid;
begin
  select * into v_entry from public.time_entries hb
   where hb.id = p_entry_id
   for update;

  if not found then
    raise exception 'time_entry not found: %', p_entry_id;
  end if;

  if v_entry.billable = false or v_entry.billing_status <> 'pending' then
    return query select v_entry.id, v_entry.billing_status;
    return;
  end if;

  if v_entry.customer_id is null then
    return query select v_entry.id, v_entry.billing_status;
    return;
  end if;

  select * into v_bank from public.hour_banks hb
   where hb.customer_id = v_entry.customer_id
     and hb.status = 'active'
   order by hb.purchase_date asc
   limit 1
   for update;

  if not found then
    if exists (
      select 1 from public.customers c
      where c.id = v_entry.customer_id and c.billing_model_default = 'hour_bank'
    ) then
      update public.time_entries te
        set billing_status = 'overage',
            is_overage = true,
            hourly_rate_at_entry = coalesce((
              select coalesce(c.hourly_rate_override, ts.default_hourly_rate)
              from public.customers c
              left join public.tenant_settings ts on ts.tenant_id = c.tenant_id
              where c.id = v_entry.customer_id
            ), 500)
        where te.id = v_entry.id;
      return query select v_entry.id, 'overage'::time_entry_billing_status;
      return;
    else
      return query select v_entry.id, 'pending'::time_entry_billing_status;
      return;
    end if;
  end if;

  v_target_bank_id := v_bank.id;

  select coalesce(sum(te.duration_minutes), 0) into v_consumed_minutes
   from public.time_entries te
   where te.consumed_from_bank_id = v_bank.id
     and te.billing_status = 'allocated_to_bank';

  v_remaining_minutes := (v_bank.purchased_hours - v_bank.absorbed_overage_hours) * 60 - v_consumed_minutes;

  if v_remaining_minutes >= v_entry.duration_minutes then
    update public.time_entries te
      set billing_status = 'allocated_to_bank',
          consumed_from_bank_id = v_bank.id,
          is_overage = false,
          hourly_rate_at_entry = v_bank.hourly_rate
      where te.id = v_entry.id;
    perform public.check_bank_alerts(v_target_bank_id);
    return query select v_entry.id, 'allocated_to_bank'::time_entry_billing_status;
    return;
  elsif v_remaining_minutes <= 0 then
    update public.time_entries te
      set billing_status = 'overage',
          is_overage = true,
          consumed_from_bank_id = null,
          hourly_rate_at_entry = coalesce((
            select coalesce(c.hourly_rate_override, ts.default_hourly_rate)
            from public.customers c
            left join public.tenant_settings ts on ts.tenant_id = c.tenant_id
            where c.id = v_entry.customer_id
          ), 500)
      where te.id = v_entry.id;
    update public.hour_banks hb set status = 'depleted' where hb.id = v_bank.id;
    perform public.check_bank_alerts(v_target_bank_id);
    return query select v_entry.id, 'overage'::time_entry_billing_status;
    return;
  else
    v_split_end := v_entry.start_time + (v_remaining_minutes || ' minutes')::interval;

    update public.time_entries te
      set end_time = v_split_end,
          duration_minutes = v_remaining_minutes::int,
          billing_status = 'allocated_to_bank',
          consumed_from_bank_id = v_bank.id,
          is_overage = false,
          hourly_rate_at_entry = v_bank.hourly_rate
      where te.id = v_entry.id;

    select coalesce(c.hourly_rate_override, ts.default_hourly_rate, 500) into v_rate
      from public.customers c
      left join public.tenant_settings ts on ts.tenant_id = c.tenant_id
      where c.id = v_entry.customer_id;

    insert into public.time_entries (
      tenant_id, user_id, customer_id, task_id, project_id,
      start_time, end_time, duration_minutes,
      billable, billing_status, is_overage, hourly_rate_at_entry, notes
    ) values (
      v_entry.tenant_id, v_entry.user_id, v_entry.customer_id, v_entry.task_id, v_entry.project_id,
      v_split_end, v_entry.end_time, (v_entry.duration_minutes - v_remaining_minutes)::int,
      true, 'overage', true, v_rate,
      v_entry.notes
    ) returning id into v_overage_id;

    update public.hour_banks hb set status = 'depleted' where hb.id = v_bank.id;
    perform public.check_bank_alerts(v_target_bank_id);

    return query select v_entry.id, 'allocated_to_bank'::time_entry_billing_status
                 union all
                 select v_overage_id, 'overage'::time_entry_billing_status;
    return;
  end if;
end
$function$
;

CREATE OR REPLACE FUNCTION public.backfill_pending_entries_to_bank(p_bank_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_bank record;
  v_entry record;
  v_count integer := 0;
begin
  select * into v_bank from public.hour_banks where id = p_bank_id;
  if not found or v_bank.status <> 'active' then return 0; end if;

  -- Loop unallocated billable entries (pending + overage) for this customer, oldest first
  for v_entry in
    select id from public.time_entries
    where tenant_id    = v_bank.tenant_id
      and customer_id  = v_bank.customer_id
      and billable     = true
      and billing_status in ('pending', 'overage')
    order by start_time asc
  loop
    perform public.allocate_time_entry_to_bank(v_entry.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_bank_alerts(p_bank_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_bank record;
  v_consumed_minutes numeric;
  v_remaining_minutes numeric;
  v_remaining_hours numeric;
  v_pct_remaining numeric;
  v_customer_name text;
  v_draft_exists boolean;
  v_admin_user_id uuid;
  v_should_have_draft boolean := false;
begin
  select * into v_bank from public.hour_banks hb where hb.id = p_bank_id;
  if not found then return; end if;
  if v_bank.status not in ('active', 'depleted') then return; end if;

  select id into v_admin_user_id
    from public.users
    where tenant_id = v_bank.tenant_id and role = 'admin'
    order by created_at asc
    limit 1;

  select coalesce(sum(te.duration_minutes), 0) into v_consumed_minutes
   from public.time_entries te
   where te.consumed_from_bank_id = p_bank_id
     and te.billing_status = 'allocated_to_bank';

  v_remaining_minutes := (v_bank.purchased_hours - v_bank.absorbed_overage_hours) * 60 - v_consumed_minutes;
  v_remaining_hours := v_remaining_minutes / 60.0;
  v_pct_remaining := case
    when v_bank.purchased_hours = 0 then 0
    else (v_remaining_minutes / (v_bank.purchased_hours * 60)) * 100
  end;

  select c.name into v_customer_name from public.customers c where c.id = v_bank.customer_id;

  -- Depletion alert
  if not v_bank.alert_sent_hours and v_remaining_hours <= 0 then
    insert into public.notifications (tenant_id, user_id, severity, title, body, link)
    values (
      v_bank.tenant_id, v_admin_user_id, 'critical',
      '🚨 ' || v_customer_name || ': בנק השעות נוצל במלואו',
      'כל ' || v_bank.purchased_hours::text || ' השעות נוצלו',
      '/hour-banks/' || p_bank_id::text
    );
    update public.hour_banks hb
      set alert_sent_hours = true, alert_sent_pct = true, status = 'depleted'
      where hb.id = p_bank_id;
  end if;

  -- Threshold alerts only for active banks with hours remaining
  if v_bank.status = 'active' and v_remaining_hours > 0 then
    if not v_bank.alert_sent_pct
       and v_pct_remaining <= v_bank.alert_threshold_pct then
      insert into public.notifications (tenant_id, user_id, severity, title, body, link)
      values (
        v_bank.tenant_id, v_admin_user_id, 'warning',
        '⏰ ' || v_customer_name || ': נשארו ' || round(v_pct_remaining)::text || '% בבנק',
        'נותרו ' || round(v_remaining_hours, 1)::text || ' מתוך ' || v_bank.purchased_hours::text || ' שעות',
        '/hour-banks/' || p_bank_id::text
      );
      update public.hour_banks hb set alert_sent_pct = true where hb.id = p_bank_id;
    end if;

    if not v_bank.alert_sent_hours
       and v_remaining_hours <= v_bank.alert_threshold_hours
       and v_bank.alert_threshold_hours < v_bank.purchased_hours then
      insert into public.notifications (tenant_id, user_id, severity, title, body, link)
      values (
        v_bank.tenant_id, v_admin_user_id, 'critical',
        '🚨 ' || v_customer_name || ': נשארו רק ' || round(v_remaining_hours, 1)::text || ' שעות',
        'בנק שעות מתקרב לסיום',
        '/hour-banks/' || p_bank_id::text
      );
      update public.hour_banks hb set alert_sent_hours = true where hb.id = p_bank_id;
    end if;
  end if;

  -- A renewal draft should exist whenever the bank is depleted OR below any threshold
  v_should_have_draft := (
    v_remaining_hours <= 0
    or v_pct_remaining <= v_bank.alert_threshold_pct
    or v_remaining_hours <= v_bank.alert_threshold_hours
  );

  if v_should_have_draft then
    select exists(
      select 1 from public.hour_banks hb
      where hb.parent_bank_id = p_bank_id and hb.status = 'draft'
    ) into v_draft_exists;

    if not v_draft_exists then
      insert into public.hour_banks (
        tenant_id, customer_id, purchased_hours, hourly_rate, purchase_date, expiry_date,
        status, parent_bank_id, alert_threshold_pct, alert_threshold_hours, notes, created_by
      ) values (
        v_bank.tenant_id, v_bank.customer_id, v_bank.purchased_hours, v_bank.hourly_rate,
        current_date,
        case when v_bank.expiry_date is not null
          then current_date + (v_bank.expiry_date - v_bank.purchase_date)
          else null end,
        'draft', p_bank_id, v_bank.alert_threshold_pct, v_bank.alert_threshold_hours,
        'טיוטה אוטומטית — נוצרה כשהבנק הקודם הגיע לרף', v_bank.created_by
      );

      insert into public.notifications (tenant_id, user_id, severity, title, body, link)
      values (
        v_bank.tenant_id, v_admin_user_id, 'info',
        '📝 טיוטת חידוש מוכנה: ' || v_customer_name,
        'נוצרה טיוטה לבנק חידוש — סקור ואשר',
        '/hour-banks/draft-renewals'
      );
    end if;
  end if;
end
$function$
;

CREATE OR REPLACE FUNCTION public.convert_lead_to_customer(p_lead_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_lead public.leads%rowtype;
  v_customer_id uuid;
begin
  -- שולף את הליד (RLS תאמת שיש גישה)
  select * into v_lead from public.leads where id = p_lead_id;

  if not found then
    raise exception 'lead not found' using errcode = 'P0001';
  end if;

  if v_lead.converted_to_customer_id is not null then
    raise exception 'lead already converted' using errcode = 'P0002';
  end if;

  -- 1. יוצר לקוח
  insert into public.customers (tenant_id, name, email, phone, company, notes, status)
  values (v_lead.tenant_id, v_lead.name, v_lead.email, v_lead.phone, v_lead.company, v_lead.notes, 'active')
  returning id into v_customer_id;

  -- 2. מעדכן ליד
  update public.leads
  set converted_to_customer_id = v_customer_id, status = 'won'
  where id = p_lead_id;

  -- 3. מעביר פעילויות
  update public.activities
  set lead_id = null, customer_id = v_customer_id
  where lead_id = p_lead_id;

  return v_customer_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.current_customer_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select customer_id from public.users where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select tenant_id from public.users where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.users where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  otto_tenant_id uuid;
  is_first_user  boolean;
  full_name_raw  text;
  invite_role    text;
BEGIN
  SELECT id INTO otto_tenant_id FROM public.tenants WHERE slug = 'otto' LIMIT 1;

  IF otto_tenant_id IS NULL THEN
    RETURN new;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.users WHERE tenant_id = otto_tenant_id
  ) INTO is_first_user;

  full_name_raw := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    null
  );

  IF is_first_user THEN
    -- First user always becomes admin
    INSERT INTO public.users (id, tenant_id, email, full_name, role)
    VALUES (new.id, otto_tenant_id, new.email, full_name_raw, 'admin')
    ON CONFLICT (id) DO NOTHING;
  ELSE
    -- Only add if there's a pending invite
    SELECT role INTO invite_role
    FROM public.user_invites
    WHERE tenant_id = otto_tenant_id
      AND lower(email) = lower(new.email)
      AND used_at IS NULL
    LIMIT 1;

    IF invite_role IS NOT NULL THEN
      INSERT INTO public.users (id, tenant_id, email, full_name, role)
      VALUES (new.id, otto_tenant_id, new.email, full_name_raw, invite_role)
      ON CONFLICT (id) DO NOTHING;

      -- Mark invite as used
      UPDATE public.user_invites
      SET used_at = now()
      WHERE tenant_id = otto_tenant_id
        AND lower(email) = lower(new.email)
        AND used_at IS NULL;
    END IF;
    -- If no invite → user is authenticated but has no users row → blocked by RLS
  END IF;

  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.portal_customer_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM customers
  WHERE email = auth.email()
    AND portal_enabled = true
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.process_expired_hour_banks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_bank record;
  v_remaining numeric;
  v_customer_name text;
  v_admin_user_id uuid;
begin
  for v_bank in
    select * from public.hour_banks
    where status = 'active' and expiry_date is not null and expiry_date < current_date
  loop
    select id into v_admin_user_id
      from public.users
      where tenant_id = v_bank.tenant_id and role = 'admin'
      order by created_at asc
      limit 1;

    select coalesce(sum(duration_minutes), 0) into v_remaining
      from public.time_entries
      where consumed_from_bank_id = v_bank.id and billing_status = 'allocated_to_bank';
    v_remaining := (v_bank.purchased_hours - v_bank.absorbed_overage_hours) * 60 - v_remaining;

    select name into v_customer_name from public.customers where id = v_bank.customer_id;

    if v_remaining > 0 then
      update public.hour_banks set status = 'expired' where id = v_bank.id;
      insert into public.notifications (tenant_id, user_id, severity, title, body, link)
      values (v_bank.tenant_id, v_admin_user_id, 'warning',
        '⚠ בנק של ' || coalesce(v_customer_name, '—') || ' פג תוקף',
        round(v_remaining / 60.0, 1)::text || ' שעות לא נוצלו',
        '/hour-banks/' || v_bank.id::text);
    else
      update public.hour_banks set status = 'depleted' where id = v_bank.id;
    end if;
  end loop;
end
$function$
;

CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key text, p_window_seconds integer, p_limit integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_hits integer;
begin
  insert into rate_limit_hits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start)
  do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Opportunistic cleanup of stale windows (~1% of calls).
  if random() < 0.01 then
    delete from rate_limit_hits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_bank(p_bank_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bank record;
  v_consumed_minutes numeric;
  v_remaining_minutes numeric;
begin
  select * into v_bank from public.hour_banks hb where hb.id = p_bank_id for update;
  if not found then return; end if;

  select coalesce(sum(te.duration_minutes), 0) into v_consumed_minutes
   from public.time_entries te
   where te.consumed_from_bank_id = p_bank_id
     and te.billing_status = 'allocated_to_bank';

  v_remaining_minutes := (v_bank.purchased_hours - v_bank.absorbed_overage_hours) * 60 - v_consumed_minutes;

  if v_bank.status = 'depleted' and v_remaining_minutes > 0 then
    update public.hour_banks hb set status = 'active', alert_sent_hours = false, alert_sent_pct = false where hb.id = p_bank_id;
  elsif v_bank.status = 'active' and v_remaining_minutes <= 0 then
    update public.hour_banks hb set status = 'depleted' where hb.id = p_bank_id;
  end if;

  perform public.check_bank_alerts(p_bank_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.tg_allocate_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bank_id uuid;
begin
  if new.billable and new.billing_status = 'pending' and new.customer_id is not null then
    perform public.allocate_time_entry_to_bank(new.id);

    select consumed_from_bank_id into v_bank_id
      from public.time_entries
      where id = new.id;

    if v_bank_id is not null then
      perform public.check_bank_alerts(v_bank_id);
    end if;
  end if;
  return new;
end
$function$
;

CREATE OR REPLACE FUNCTION public.update_documents_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_invoice_status_from_payments()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_invoice_id uuid;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);
  select i.total_amount into v_total from public.invoices i where i.id = v_invoice_id;
  select coalesce(sum(p.amount), 0) into v_paid from public.payments p where p.invoice_id = v_invoice_id;

  update public.invoices i
    set status = case
          when v_paid >= v_total then 'paid'
          when v_paid > 0 then 'partial'
          when i.status in ('paid','partial') then 'sent'
          else i.status
        end,
        paid_at = case when v_paid >= v_total then now() else null end
    where i.id = v_invoice_id;

  return null;
end $function$
;


-- ===== TRIGGERS =====

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER hour_banks_set_updated_at BEFORE UPDATE ON public.hour_banks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payments_update_invoice AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_invoice_status_from_payments();
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();
CREATE TRIGGER time_entries_allocate_after_insert AFTER INSERT ON public.time_entries FOR EACH ROW EXECUTE FUNCTION tg_allocate_on_insert();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ===== VIEWS =====

CREATE OR REPLACE VIEW hour_banks_summary AS  SELECT id,
    tenant_id,
    customer_id,
    purchased_hours,
    hourly_rate,
    total_amount,
    purchase_date,
    expiry_date,
    status,
    parent_bank_id,
    absorbed_overage_hours,
    alert_threshold_pct,
    alert_threshold_hours,
    alert_sent_pct,
    alert_sent_hours,
    notes,
    invoice_id,
    created_at,
    created_by,
    updated_at,
    (COALESCE(( SELECT ((sum(te.duration_minutes))::numeric / 60.0)
           FROM time_entries te
          WHERE ((te.consumed_from_bank_id = hb.id) AND (te.billing_status = 'allocated_to_bank'::time_entry_billing_status))), (0)::numeric))::numeric(8,2) AS consumed_hours,
    (((purchased_hours - absorbed_overage_hours) - COALESCE(( SELECT ((sum(te.duration_minutes))::numeric / 60.0)
           FROM time_entries te
          WHERE ((te.consumed_from_bank_id = hb.id) AND (te.billing_status = 'allocated_to_bank'::time_entry_billing_status))), (0)::numeric)))::numeric(8,2) AS available_hours
   FROM hour_banks hb;

CREATE OR REPLACE VIEW invoices_aging AS  SELECT id,
    tenant_id,
    customer_id,
    number,
    issue_date,
    due_date,
    total_amount,
    status,
    document_type,
        CASE
            WHEN (status = 'paid'::invoice_status) THEN 0
            WHEN (due_date IS NULL) THEN 0
            ELSE GREATEST(0, (CURRENT_DATE - due_date))
        END AS days_overdue,
        CASE
            WHEN (status = 'paid'::invoice_status) THEN 'paid'::text
            WHEN ((due_date IS NULL) OR (due_date >= CURRENT_DATE)) THEN 'current'::text
            WHEN ((CURRENT_DATE - due_date) <= 30) THEN '1-30'::text
            WHEN ((CURRENT_DATE - due_date) <= 60) THEN '31-60'::text
            WHEN ((CURRENT_DATE - due_date) <= 90) THEN '61-90'::text
            ELSE '90+'::text
        END AS age_bucket,
    COALESCE(( SELECT sum(p.amount) AS sum
           FROM payments p
          WHERE (p.invoice_id = i.id)), (0)::numeric) AS paid_amount
   FROM invoices i;


-- ===== ROW LEVEL SECURITY (enable) =====

ALTER TABLE active_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

