-- otto-4: Supabase-backed rate limiting (fixed-window counters).
-- Used by lib/rate-limit.ts. The app fails OPEN if this migration has not
-- been applied yet, so applying it later is safe.

create table if not exists rate_limit_hits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

-- Service-role only: RLS enabled with no policies blocks anon/authenticated.
alter table rate_limit_hits enable row level security;

create or replace function rate_limit_hit(
  p_key text,
  p_window_seconds integer,
  p_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- Only the service role may call it.
revoke execute on function rate_limit_hit(text, integer, integer) from public;
revoke execute on function rate_limit_hit(text, integer, integer) from anon;
revoke execute on function rate_limit_hit(text, integer, integer) from authenticated;
