-- Ensure a renewal draft is created when the bank is depleted (or below any threshold),
-- not only on the first threshold crossing. Previously the depletion branch returned
-- early before reaching the draft-creation block, so banks that jumped straight to 0
-- never produced a draft.

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

  -- A renewal draft should exist whenever the bank is depleted OR below any threshold.
  -- Idempotent: the existence check below prevents duplicate drafts.
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
$function$;
