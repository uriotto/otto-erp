-- Additive read API. Rollback can drop this function and index without changing entries.
create index if not exists time_entries_timer_history_idx
  on public.time_entries (tenant_id, user_id, start_time desc, id desc);

create or replace function public.desktop_timer_history(p_cursor jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_tenant uuid;
  v_start timestamptz := 'infinity'::timestamptz;
  v_id uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid;
  v_entries jsonb;
  v_count integer;
begin
  if v_user is null then raise exception 'NOT_AUTHORIZED'; end if;
  select tenant_id into v_tenant from public.users
    where id=v_user and role in ('admin','team');
  if v_tenant is null then raise exception 'NOT_AUTHORIZED'; end if;
  if p_cursor is not null and p_cursor <> 'null'::jsonb then
    if jsonb_typeof(p_cursor) <> 'object' then raise exception 'INVALID_INPUT'; end if;
    begin
      v_start := (p_cursor->>'start_time')::timestamptz;
      v_id := (p_cursor->>'id')::uuid;
    exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception 'INVALID_INPUT';
    end;
    if v_start is null or not isfinite(v_start) or v_id is null then
      raise exception 'INVALID_INPUT';
    end if;
  end if;

  with candidates as materialized (
    select id,xmin::text as edit_version,customer_id,notes,start_time,end_time,
      duration_minutes,billing_status,invoice_id,project_id,task_id,billable
    from public.time_entries
    where tenant_id=v_tenant and user_id=v_user and (start_time,id) < (v_start,v_id)
    order by start_time desc,id desc limit 31
  ), page as (
    select id,edit_version,customer_id,notes,start_time,end_time,duration_minutes,
      billing_status,invoice_id,project_id,task_id,billable
    from candidates order by start_time desc,id desc limit 30
  )
  select (select count(*) from candidates),
    coalesce(jsonb_agg(to_jsonb(page) order by start_time desc,id desc),'[]'::jsonb)
  into v_count,v_entries from page;
  return jsonb_build_object('entries',v_entries,'hasMore',v_count > 30,
    'cursor',case when v_count > 30 then
      jsonb_build_object('start_time',v_entries->29->'start_time','id',v_entries->29->'id')
    else null end);
end;
$$;
revoke all on function public.desktop_timer_history(jsonb) from public, anon, service_role;
grant execute on function public.desktop_timer_history(jsonb) to authenticated;
