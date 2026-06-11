-- otto-8: allow revoking bot API tokens.
-- authenticateBot (lib/bot-auth.ts) checks revoked_at when the column exists,
-- and tolerates it being missing until this migration is applied.

alter table bot_api_tokens
  add column if not exists revoked_at timestamptz;

comment on column bot_api_tokens.revoked_at is
  'When set, the token is dead. Rotation policy: revoke + reissue every 90 days.';
