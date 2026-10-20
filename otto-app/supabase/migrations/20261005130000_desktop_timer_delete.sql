-- Additive RPC change; no existing entries are modified by applying this migration.
-- Rollback: restore the previous desktop_timer wrapper in a forward migration,
-- then drop timer_delete_entry_internal. Deleted entries require backup recovery.
create or replace function public.timer_delete_entry_internal(p_user uuid, p_tenant uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid;
  v_id uuid;
  v_entry public.time_entries%rowtype;
  v_edit_version text;
begin
  if p_user is null then raise exception 'NOT_AUTHORIZED'; end if;
  -- Match the timer RPC lock order: user first, entry second, then bank.
  select tenant_id into v_tenant from public.users
    where id=p_user and role in ('admin','team') for update;
  if v_tenant is null or v_tenant is distinct from p_tenant then raise exception 'NOT_AUTHORIZED'; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then raise exception 'INVALID_INPUT'; end if;
  v_id := (p_input->>'id')::uuid;
  if v_id is null or coalesce(p_input->>'edit_version','') !~ '^[0-9]+$' then raise exception 'INVALID_INPUT'; end if;

  select * into v_entry from public.time_entries
    where id=v_id and user_id=p_user and tenant_id=v_tenant for update;
  if found then
    select xmin::text into v_edit_version from public.time_entries where id=v_entry.id;
    if v_edit_version is distinct from p_input->>'edit_version' then raise exception 'ENTRY_STALE'; end if;
    if v_entry.invoice_id is not null or v_entry.billing_status in ('invoiced','settled_externally','cancelled') then
      raise exception 'ENTRY_LOCKED';
    end if;
    delete from public.time_entries where id=v_entry.id;
    if v_entry.consumed_from_bank_id is not null then
      perform public.recalculate_bank(v_entry.consumed_from_bank_id);
    end if;
  end if;
  -- Missing and non-owned entries return the same result. A retry has no side effects.
  -- Keep timer_completions: delayed stop retries must not recreate deleted entries.
  return public.timer_operation_internal(p_user,v_tenant,'snapshot','{}'::jsonb);
end;
$$;
revoke all on function public.timer_delete_entry_internal(uuid,uuid,jsonb) from public, anon, authenticated, service_role;

create or replace function public.desktop_timer(p_operation text, p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
  if p_operation is null or p_operation not in ('snapshot','start','update','stop','cancel','entry','delete') then raise exception 'INVALID_INPUT'; end if;
  select tenant_id into v_tenant from public.users where id=auth.uid();
  if p_operation = 'delete' then
    return public.timer_delete_entry_internal(auth.uid(),v_tenant,p_input);
  end if;
  return public.timer_operation_internal(auth.uid(),v_tenant,p_operation,p_input);
end;
$$;
revoke all on function public.desktop_timer(text,jsonb) from public, anon, service_role;
grant execute on function public.desktop_timer(text,jsonb) to authenticated;
