-- Long-lived API tokens used by external bots (Telegram, etc.) to call
-- /api/bot/* endpoints on behalf of a specific user. The plaintext token is
-- only shown once at creation time; the DB stores a SHA-256 hash.

create table bot_api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  token_hash text not null unique,
  label text,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index bot_api_tokens_user_idx on bot_api_tokens(user_id);

alter table bot_api_tokens enable row level security;

create policy "users manage own bot tokens" on bot_api_tokens
  for all
  using (
    user_id = auth.uid()
    and tenant_id = (select tenant_id from users where id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and tenant_id = (select tenant_id from users where id = auth.uid())
  );
