-- Billing engine fixes (2026-07-03)
--
-- Policy decisions (Uri):
--   1. Rate is captured on every billable entry at creation time (rate freeze).
--      Precedence: customer.hourly_rate_override -> tenant_settings.default_hourly_rate.
--   2. Single default rate: 425. The hard-coded 500 fallback and the orphaned
--      default_hour_bank_rate are no longer used.
--   3. Absorbing overage into a bank consumes capacity ONCE: absorbed entries are
--      counted via their allocated minutes. absorbed_overage_hours becomes a purely
--      informational counter and is removed from every capacity formula (it used to
--      be subtracted on top of the allocated minutes = double count).
--   4. A renewal draft is created only if the bank has NO renewal child at all
--      (any non-cancelled status), not just no draft - prevents serial duplicate drafts.

-- ============================================================
-- 1. Default rate: 425
-- ============================================================

alter table public.tenant_settings alter column default_hourly_rate set default 425.00;

-- Single-tenant setup: the live default was a stale 500. Uri's stated default is 425.
-- Per-customer overrides are untouched (they take precedence over this fallback).
update public.tenant_settings set default_hourly_rate = 425.00;

-- ============================================================
-- 2. allocate_time_entry_to_bank
--    - rate freeze for pending entries (no bank, hourly-model customer)
--    - drop hard-coded 500 fallback
--    - drop absorbed_overage_hours from the capacity formula
-- ============================================================

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

  -- Effective customer rate (customer override -> tenant default)
  select coalesce(c.hourly_rate_override, ts.default_hourly_rate) into v_rate
    from public.customers c
    left join public.tenant_settings ts on ts.tenant_id = c.tenant_id
    where c.id = v_entry.customer_id;

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
            hourly_rate_at_entry = coalesce(te.hourly_rate_at_entry, v_rate)
        where te.id = v_entry.id;
      return query select v_entry.id, 'overage'::time_entry_billing_status;
      return;
    else
      -- Hourly-model customer: stays pending but the rate is frozen now.
      update public.time_entries te
        set hourly_rate_at_entry = coalesce(te.hourly_rate_at_entry, v_rate)
        where te.id = v_entry.id;
      return query select v_entry.id, 'pending'::time_entry_billing_status;
      return;
    end if;
  end if;

  v_target_bank_id := v_bank.id;

  select coalesce(sum(te.duration_minutes), 0) into v_consumed_minutes
   from public.time_entries te
   where te.consumed_from_bank_id = v_bank.id
     and te.billing_status = 'allocated_to_bank';

  v_remaining_minutes := v_bank.purchased_hours * 60 - v_consumed_minutes;

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
          hourly_rate_at_entry = coalesce(te.hourly_rate_at_entry, v_rate)
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

-- ============================================================
-- 3. check_bank_alerts
--    - drop absorbed_overage_hours from the capacity formula
--    - renewal draft guard: block if ANY non-cancelled child exists
-- ============================================================

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
  v_child_exists boolean;
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

  v_remaining_minutes := v_bank.purchased_hours * 60 - v_consumed_minutes;
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
    -- Any non-cancelled renewal child (draft OR already approved) blocks a new draft,
    -- so an approved renewal doesn't spawn duplicates when the parent dips again.
    select exists(
      select 1 from public.hour_banks hb
      where hb.parent_bank_id = p_bank_id and hb.status <> 'cancelled'
    ) into v_child_exists;

    if not v_child_exists then
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

-- ============================================================
-- 4. recalculate_bank - drop absorbed_overage_hours from formula
-- ============================================================

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

  v_remaining_minutes := v_bank.purchased_hours * 60 - v_consumed_minutes;

  if v_bank.status = 'depleted' and v_remaining_minutes > 0 then
    update public.hour_banks hb set status = 'active', alert_sent_hours = false, alert_sent_pct = false where hb.id = p_bank_id;
  elsif v_bank.status = 'active' and v_remaining_minutes <= 0 then
    update public.hour_banks hb set status = 'depleted' where hb.id = p_bank_id;
  end if;

  perform public.check_bank_alerts(p_bank_id);
end $function$
;

-- ============================================================
-- 5. process_expired_hour_banks - drop absorbed_overage_hours from formula
-- ============================================================

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
    v_remaining := v_bank.purchased_hours * 60 - v_remaining;

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

-- ============================================================
-- 6. hour_banks_summary view - available_hours without the double subtraction.
--    absorbed_overage_hours stays exposed as an informational counter only.
-- ============================================================

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
    ((purchased_hours - COALESCE(( SELECT ((sum(te.duration_minutes))::numeric / 60.0)
           FROM time_entries te
          WHERE ((te.consumed_from_bank_id = hb.id) AND (te.billing_status = 'allocated_to_bank'::time_entry_billing_status))), (0)::numeric)))::numeric(8,2) AS available_hours
   FROM hour_banks hb;

-- ============================================================
-- 7. Data backfill
-- ============================================================

-- 7a. Freeze a rate on every billable entry that never got one (hourly-model
--     customers whose entries stayed pending with NULL rate).
update public.time_entries te
   set hourly_rate_at_entry = coalesce(c.hourly_rate_override, ts.default_hourly_rate)
  from public.customers c
  left join public.tenant_settings ts on ts.tenant_id = c.tenant_id
 where te.customer_id = c.id
   and te.hourly_rate_at_entry is null
   and te.billable = true
   and te.billing_status in ('pending', 'overage');

-- 7b. Recalculate every live bank under the corrected formula
--     (banks wrongly depleted by the double subtraction come back to active).
do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.hour_banks where status in ('active', 'depleted') loop
    perform public.recalculate_bank(v_id);
  end loop;
end $$;
