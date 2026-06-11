-- otto-3: replace the wide-open public INSERT policy on booking_slots.
-- The old policy allowed anyone with the anon key to insert unlimited rows
-- for any tenant. The new policy requires:
--   * the referenced booking_type exists and is active
--   * the slot's tenant_id matches the booking_type's tenant
--   * status is 'confirmed' (anon cannot insert cancelled/garbage states)
--   * a sane time range (end after start, start not in the past)

drop policy if exists "public insert booking slots" on booking_slots;

create policy "public insert booking slots" on booking_slots
  for insert
  with check (
    status = 'confirmed'
    and end_at > start_at
    and start_at > now()
    and end_at < start_at + interval '1 day'
    and exists (
      select 1
      from booking_types bt
      where bt.id = booking_slots.booking_type_id
        and bt.is_active = true
        and bt.tenant_id = booking_slots.tenant_id
    )
  );
