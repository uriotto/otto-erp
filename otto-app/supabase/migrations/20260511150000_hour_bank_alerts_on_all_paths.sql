-- Make check_bank_alerts fire on every allocation path (insert/update/delete/recalc)
-- by embedding it inside the core SQL functions instead of relying only on the INSERT trigger.
-- Fixes a bug where updateTimeEntry → allocate_time_entry_to_bank ran without firing alerts,
-- and where allocate's "exact consumption" branch never flipped status to depleted.

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
$function$;

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
end $function$;
