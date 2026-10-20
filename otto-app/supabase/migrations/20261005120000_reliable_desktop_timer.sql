-- Prepared locally only. Apply through the approved migration process.
alter table public.active_timers add column session_id uuid not null default gen_random_uuid();
alter table public.active_timers add column revision integer not null default 1 check (revision > 0);
create unique index active_timers_session_id_key on public.active_timers(session_id);

-- Kept after a saved entry is edited/deleted so a delayed stop cannot insert twice.
create table public.timer_completions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entry_id uuid,
  duration_minutes integer,
  outcome text not null check (outcome in ('stop', 'cancel')),
  created_at timestamptz not null default now()
);
alter table public.timer_completions enable row level security;
revoke all on public.timer_completions from anon, authenticated;
-- Stable bot restart keys survive lost responses. JSONB is the canonical input fingerprint.
create table public.timer_restart_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid not null,
  input_fingerprint jsonb not null,
  stopped_previous jsonb,
  started_result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.timer_restart_requests enable row level security;
revoke all on public.timer_restart_requests from public, anon, authenticated, service_role;

-- Writes must go through the checked, transactional RPC. SELECT/realtime stays available.
revoke insert, update, delete on public.active_timers from authenticated, anon;

create or replace function public.timer_operation_internal(p_user uuid, p_tenant uuid, p_operation text, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := p_user;
  v_request_id uuid;
  v_request_fingerprint jsonb;
  v_existing_request public.timer_restart_requests%rowtype;
  v_replayed boolean := false;
  v_saved uuid;
  v_previous jsonb;
  v_started_result jsonb;
  v_edit_version text;
  v_duration integer;
  v_tenant uuid;
  v_timer public.active_timers%rowtype;
  v_entry public.time_entries%rowtype;
  v_customer uuid;
  v_project uuid;
  v_task uuid;
  v_notes text;
  v_start timestamptz;
  v_end timestamptz;
  v_session uuid;
  v_revision integer;
  v_active jsonb;
  v_customers jsonb;
  v_entries jsonb;
begin
  if v_user is null then raise exception 'NOT_AUTHORIZED'; end if;
  -- Serializes operations even when no active row exists, preventing racing starts/stops.
  select tenant_id into v_tenant from public.users where id = v_user and role in ('admin','team') for update;
  if v_tenant is null or v_tenant is distinct from p_tenant then raise exception 'NOT_AUTHORIZED'; end if;
  if p_operation is null or p_operation not in ('snapshot','start','restart','update','stop','cancel','entry') then raise exception 'INVALID_INPUT'; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then raise exception 'INVALID_INPUT'; end if;

  if p_operation = 'restart' then
    v_request_id := (p_input->>'request_id')::uuid;
    if v_request_id is null then raise exception 'INVALID_INPUT'; end if;
    v_request_fingerprint := p_input - 'request_id';
    select * into v_existing_request from public.timer_restart_requests
      where user_id=v_user and request_id=v_request_id;
    if found then
      if v_existing_request.tenant_id is distinct from v_tenant or v_existing_request.input_fingerprint is distinct from v_request_fingerprint then
        raise exception 'REQUEST_CONFLICT';
      end if;
      v_previous := v_existing_request.stopped_previous;
      v_started_result := v_existing_request.started_result;
      v_replayed := true;
      p_operation := 'snapshot';
    else
      select * into v_timer from public.active_timers where user_id=v_user and tenant_id=v_tenant for update;
      if found then
        v_previous := public.timer_operation_internal(v_user,v_tenant,'stop',jsonb_build_object('session_id',v_timer.session_id,'revision',v_timer.revision))->'operation_result';
      end if;
      v_timer := null;
      p_operation := 'start';
    end if;
  end if;

  if p_operation in ('update','stop','cancel') then
    v_session := (p_input->>'session_id')::uuid;
    v_revision := (p_input->>'revision')::integer;
    if v_session is null or v_revision is null or v_revision < 1 then raise exception 'INVALID_INPUT'; end if;
    if p_operation in ('stop','cancel') and exists (
      select 1 from public.timer_completions where session_id = v_session and user_id = v_user
      and tenant_id = v_tenant and outcome = p_operation
    ) then
      select entry_id,duration_minutes into v_saved,v_duration from public.timer_completions where session_id=v_session;
      p_operation := 'snapshot';
    else
      select * into v_timer from public.active_timers where user_id = v_user and tenant_id = v_tenant for update;
      if not found or v_timer.session_id <> v_session or v_timer.revision <> v_revision then raise exception 'TIMER_STALE'; end if;
    end if;
  end if;

  if p_operation in ('start','update','stop','entry') then
    if p_operation = 'entry' then
      select * into v_entry from public.time_entries
      where id = (p_input->>'id')::uuid and user_id = v_user and tenant_id = v_tenant for update;
      if not found then raise exception 'NOT_AUTHORIZED'; end if;
      select xmin::text into v_edit_version from public.time_entries where id=v_entry.id;
      if v_edit_version is distinct from p_input->>'edit_version' then raise exception 'ENTRY_STALE'; end if;
      if v_entry.invoice_id is not null or v_entry.billing_status in ('invoiced','settled_externally','cancelled') then raise exception 'ENTRY_LOCKED'; end if;
    end if;
    v_customer := case when p_input ? 'customer_id' then (p_input->>'customer_id')::uuid else v_timer.customer_id end;
    v_notes := case when p_input ? 'notes' then p_input->>'notes' else v_timer.notes end;
    v_start := coalesce((p_input->>'started_at')::timestamptz, v_timer.started_at, now());
    v_end := coalesce((p_input->>'end_time')::timestamptz, now());
    v_project := case when p_input ? 'project_id' then (p_input->>'project_id')::uuid else v_timer.project_id end;
    v_task := case when p_input ? 'task_id' then (p_input->>'task_id')::uuid else v_timer.task_id end;
    if p_operation = 'entry' then
      v_start := (p_input->>'start_time')::timestamptz;
      v_project := v_entry.project_id;
      v_task := v_entry.task_id;
      if v_customer is distinct from v_entry.customer_id then v_project := null; v_task := null; end if;
    elsif v_customer is distinct from v_timer.customer_id then
      if not (p_input ? 'project_id') then v_project := null; end if;
      if not (p_input ? 'task_id') then v_task := null; end if;
    end if;
    if v_start is null or not isfinite(v_start) or v_start > now() or length(v_notes) > 4000
      or (p_operation in ('stop','entry') and (v_end is null or not isfinite(v_end) or v_end <= v_start or v_end > now())) then raise exception 'INVALID_INPUT'; end if;
    if v_customer is not null and not exists (select 1 from public.customers where id = v_customer and tenant_id = v_tenant) then raise exception 'NOT_AUTHORIZED'; end if;
    if v_project is not null and not exists (select 1 from public.projects where id = v_project and tenant_id = v_tenant and customer_id is not distinct from v_customer and deleted_at is null) then raise exception 'NOT_AUTHORIZED'; end if;
    if v_task is not null and not exists (select 1 from public.tasks where id = v_task and tenant_id = v_tenant and project_id is not distinct from v_project) then raise exception 'NOT_AUTHORIZED'; end if;
  end if;

  if p_operation = 'start' then
    if exists(select 1 from public.active_timers where user_id = v_user) then raise exception 'TIMER_ACTIVE'; end if;
    insert into public.active_timers(user_id,tenant_id,customer_id,project_id,task_id,notes,started_at,source)
    values(v_user,v_tenant,v_customer,v_project,v_task,v_notes,v_start,coalesce(p_input->>'source','web'))
    returning jsonb_build_object('session_id',session_id,'revision',revision,'started_at',started_at) into v_started_result;
  elsif p_operation = 'update' then
    update public.active_timers set customer_id=v_customer,project_id=v_project,task_id=v_task,notes=v_notes,started_at=v_start,revision=revision+1 where user_id=v_user;
  elsif p_operation = 'stop' then
    -- Existing allocation trigger runs inside this transaction. Any failure rolls back the stop.
    insert into public.time_entries(tenant_id,user_id,customer_id,project_id,task_id,notes,start_time,end_time,duration_minutes,billable,billing_status)
    values(v_tenant,v_user,v_customer,v_project,v_task,v_notes,v_start,v_end,greatest(1,ceil(extract(epoch from (v_end-v_start))/60)::integer),true,'pending') returning id into v_saved;
    v_duration := greatest(1,ceil(extract(epoch from (v_end-v_start))/60)::integer);
    insert into public.timer_completions(session_id,user_id,tenant_id,outcome,entry_id,duration_minutes) values(v_session,v_user,v_tenant,'stop',v_saved,v_duration);
    delete from public.active_timers where user_id=v_user and session_id=v_session;
  elsif p_operation = 'cancel' then
    insert into public.timer_completions(session_id,user_id,tenant_id,outcome) values(v_session,v_user,v_tenant,'cancel');
    delete from public.active_timers where user_id=v_user and session_id=v_session;
  elsif p_operation = 'entry' then
    update public.time_entries set customer_id=v_customer,project_id=v_project,task_id=v_task,notes=v_notes,start_time=v_start,end_time=v_end,
      duration_minutes=greatest(1,ceil(extract(epoch from(v_end-v_start))/60)::integer),billing_status='pending',consumed_from_bank_id=null,is_overage=false,
      hourly_rate_at_entry=case when v_customer is distinct from v_entry.customer_id then null else hourly_rate_at_entry end
      where id=v_entry.id;
    if v_entry.consumed_from_bank_id is not null then
      perform public.recalculate_bank(v_entry.consumed_from_bank_id);
    end if;
    if v_customer is not null and v_entry.billable then perform public.allocate_time_entry_to_bank(v_entry.id); end if;
  end if;

  if v_request_id is not null and not v_replayed then
    insert into public.timer_restart_requests(user_id,tenant_id,request_id,input_fingerprint,stopped_previous,started_result)
      values(v_user,v_tenant,v_request_id,v_request_fingerprint,v_previous,v_started_result);
  end if;

  select jsonb_build_object('session_id',session_id,'revision',revision,'customer_id',customer_id,'project_id',project_id,'task_id',task_id,'notes',notes,'started_at',started_at)
  into v_active from public.active_timers where user_id=v_user and tenant_id=v_tenant;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]'::jsonb)
  into v_customers from public.customers where tenant_id=v_tenant;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.start_time desc),'[]'::jsonb) into v_entries from (
    select id,xmin::text as edit_version,customer_id,notes,start_time,end_time,duration_minutes,billing_status,invoice_id,project_id,task_id,billable
    from public.time_entries where user_id=v_user and tenant_id=v_tenant order by start_time desc limit 30
  ) e;
  return jsonb_build_object('active',v_active,'customers',v_customers,'entries',v_entries,'stopped_previous',v_previous,'replayed',v_replayed,'started_result',v_started_result,'operation_result',jsonb_build_object('entry_id',v_saved,'duration_minutes',v_duration));
end;
$$;
revoke all on function public.timer_operation_internal(uuid,uuid,text,jsonb) from public, anon, authenticated, service_role;

create or replace function public.desktop_timer(p_operation text, p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHORIZED'; end if;
  if p_operation is null or p_operation not in ('snapshot','start','update','stop','cancel','entry') then raise exception 'INVALID_INPUT'; end if;
  select tenant_id into v_tenant from public.users where id=auth.uid();
  return public.timer_operation_internal(auth.uid(),v_tenant,p_operation,p_input);
end;
$$;
revoke all on function public.desktop_timer(text,jsonb) from public, anon, service_role;
grant execute on function public.desktop_timer(text,jsonb) to authenticated;

-- Server bot route must authenticate its token before supplying this actor.
create or replace function public.bot_timer(p_user uuid,p_tenant uuid,p_operation text,p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'NOT_AUTHORIZED'; end if;
  if p_operation is null or p_operation not in ('start','restart','stop','update','cancel') then raise exception 'INVALID_INPUT'; end if;
  return public.timer_operation_internal(p_user,p_tenant,p_operation,p_input);
end;
$$;
revoke all on function public.bot_timer(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.bot_timer(uuid,uuid,text,jsonb) to service_role;
