-- Recording Brain: idempotency flags for the vault poller.
-- The poller queries recordings where status='transcribed' AND vault_processed_at IS NULL,
-- distributes insights into UriVault, then stamps vault_processed_at.
-- vault_retry_count caps retries (poller filter: vault_retry_count < 3).
-- Additive only - does not touch existing columns or data.

alter table recordings add column if not exists vault_processed_at timestamptz;
alter table recordings add column if not exists vault_retry_count integer not null default 0;
