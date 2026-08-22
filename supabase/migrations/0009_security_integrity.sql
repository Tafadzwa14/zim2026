-- Security and integrity hardening. Apply after 0008.

-- ---------------------------------------------------------------- identity
alter table users add column if not exists session_version integer not null default 0;
alter table users add column if not exists claim_token_hash text;
alter table users add column if not exists username_normalized text
  generated always as (lower(trim(username))) stored;
create unique index if not exists users_username_normalized_idx on users (username_normalized);

-- A creator can be removed; the FK already requests SET NULL, so the column
-- must permit the result.
alter table plans alter column created_by drop not null;

create table if not exists auth_rate_limits (
  key text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz
);
alter table auth_rate_limits enable row level security;
revoke all on auth_rate_limits from public, anon, authenticated;

create or replace function consume_auth_attempt(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_limit auth_rate_limits%rowtype;
begin
  insert into auth_rate_limits as a (key, attempts, window_started_at, blocked_until)
  values (p_key, 1, now(), null)
  on conflict (key) do update set
    attempts = case
      when a.window_started_at < now() - interval '15 minutes' then 1
      else a.attempts + 1
    end,
    window_started_at = case
      when a.window_started_at < now() - interval '15 minutes' then now()
      else a.window_started_at
    end,
    blocked_until = case
      when a.blocked_until > now() then a.blocked_until
      when a.window_started_at < now() - interval '15 minutes' then null
      when a.attempts + 1 > 5 then now() + interval '15 minutes'
      else null
    end
  returning * into v_limit;
  return v_limit.blocked_until is null or v_limit.blocked_until <= now();
end;
$$;

create or replace function clear_auth_attempts(p_key text)
returns void
language sql
security definer
set search_path = public
as $$ delete from auth_rate_limits where key = p_key $$;

create or replace function claim_user(
  p_user_id uuid,
  p_emoji text,
  p_pin_hash text,
  p_claim_token_hash text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare new_version integer;
begin
  update users set
    emoji = p_emoji,
    pin_hash = p_pin_hash,
    claim_token_hash = null,
    session_version = session_version + 1
  where id = p_user_id
    and pin_hash = 'PENDING'
    and claim_token_hash = p_claim_token_hash
  returning session_version into new_version;
  return coalesce(new_version, -1);
end;
$$;

create or replace function reset_user_pin(p_user_id uuid, p_claim_token_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  update users set
    pin_hash = 'PENDING',
    claim_token_hash = p_claim_token_hash,
    pin_reset_requested = false,
    session_version = session_version + 1
  where id = p_user_id
$$;

-- ---------------------------------------------------------------- atomic writes
create or replace function create_plan_atomic(p_plan jsonb, p_attendees uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_plan_id uuid;
begin
  insert into plans (title, description, category, date, start_time, location, anyone_can_join, created_by)
  values (
    p_plan->>'title', nullif(p_plan->>'description', ''), p_plan->>'category',
    (p_plan->>'date')::date, nullif(p_plan->>'start_time', '')::time,
    nullif(p_plan->>'location', ''), coalesce((p_plan->>'anyone_can_join')::boolean, true),
    (p_plan->>'created_by')::uuid
  ) returning id into v_plan_id;

  insert into plan_attendees (plan_id, user_id, added_by)
  select v_plan_id, attendee, (p_plan->>'created_by')::uuid
  from unnest(p_attendees) attendee
  on conflict (plan_id, user_id) do nothing;
  return v_plan_id;
end;
$$;

create or replace function create_travel_atomic(
  p_group jsonb,
  p_travellers uuid[],
  p_legs jsonb,
  p_pickup boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_group_id uuid;
declare leg jsonb;
declare v_leg_id uuid;
begin
  insert into travel_groups (title, status, general_notes, created_by)
  values (p_group->>'title', 'upcoming', nullif(p_group->>'notes', ''), (p_group->>'created_by')::uuid)
  returning id into v_group_id;

  insert into travel_group_members (travel_group_id, user_id)
  select v_group_id, traveller from unnest(p_travellers) traveller;

  for leg in select value from jsonb_array_elements(p_legs)
  loop
    insert into flight_legs (
      travel_group_id, leg_order, provider, provider_flight_id, flight_number,
      airline_code, airline_name, origin_airport, origin_city,
      destination_airport, destination_city, scheduled_departure,
      scheduled_arrival, estimated_arrival, terminal_departure, aircraft_type,
      aircraft_type_code, aircraft_registration, status
    ) values (
      v_group_id, (leg->>'leg_order')::integer, nullif(leg->>'provider', ''), nullif(leg->>'provider_flight_id', ''), leg->>'flight_number',
      nullif(leg->>'airline_code', ''), nullif(leg->>'airline_name', ''), leg->>'origin_airport', nullif(leg->>'origin_city', ''),
      leg->>'destination_airport', nullif(leg->>'destination_city', ''), nullif(leg->>'scheduled_departure', '')::timestamptz,
      nullif(leg->>'scheduled_arrival', '')::timestamptz, nullif(leg->>'estimated_arrival', '')::timestamptz,
      nullif(leg->>'terminal_departure', ''), nullif(leg->>'aircraft_type', ''), nullif(leg->>'aircraft_type_code', ''),
      nullif(leg->>'aircraft_registration', ''), coalesce(nullif(leg->>'status', ''), 'scheduled')
    ) returning id into v_leg_id;

    if p_pickup and upper(trim(leg->>'destination_airport')) = 'HRE' then
      insert into pickups (travel_group_id, flight_leg_id, requested)
      values (v_group_id, v_leg_id, true);
    end if;
  end loop;
  return v_group_id;
end;
$$;

create or replace function create_poll_atomic(p_question text, p_options text[], p_created_by uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_poll_id uuid;
begin
  insert into polls (question, created_by) values (p_question, p_created_by) returning id into v_poll_id;
  insert into poll_options (poll_id, label, sort_order)
  select v_poll_id, label, ordinal - 1 from unnest(p_options) with ordinality as option(label, ordinal);
  return v_poll_id;
end;
$$;

-- ---------------------------------------------------------------- poll integrity
delete from poll_votes v
where not exists (
  select 1 from poll_options o where o.id = v.option_id and o.poll_id = v.poll_id
);
create unique index if not exists poll_options_id_poll_idx on poll_options (id, poll_id);
alter table poll_votes drop constraint if exists poll_votes_option_poll_fkey;
alter table poll_votes add constraint poll_votes_option_poll_fkey
  foreign key (option_id, poll_id) references poll_options(id, poll_id) on delete cascade;

create or replace function vote_poll_secure(p_poll_id uuid, p_option_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from polls where id = p_poll_id and closed = false) then return false; end if;
  if not exists (select 1 from poll_options where id = p_option_id and poll_id = p_poll_id) then return false; end if;
  insert into poll_votes (poll_id, option_id, user_id)
  values (p_poll_id, p_option_id, p_user_id)
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------- pickups per flight leg
alter table pickups drop constraint if exists pickups_travel_group_id_key;
update pickups p set flight_leg_id = coalesce(
  (select l.id from flight_legs l
   where l.travel_group_id = p.travel_group_id and upper(trim(l.destination_airport)) = 'HRE'
   order by l.leg_order limit 1),
  p.flight_leg_id
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pickups_flight_leg_id_key') then
    alter table pickups add constraint pickups_flight_leg_id_key unique (flight_leg_id);
  end if;
end $$;

-- ---------------------------------------------------------------- privacy
-- The application uses its signed server session and the service role for all
-- reads. The browser must not be able to bypass that boundary with the anon key.
do $$
declare t text;
begin
  foreach t in array array[
    'users','plans','plan_attendees','travel_groups','travel_group_members','flight_legs',
    'pickups','shopping_items','tasks','important_info','announcements','activity',
    'app_settings','places','polls','poll_options','poll_votes','photos'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('revoke all on %I from public, anon, authenticated', t);
  end loop;
end $$;
revoke all on users_public from public, anon, authenticated;
update storage.buckets set public = false where id = 'photos';

-- RPCs are service-role-only. Server actions authenticate and authorise before
-- calling them; no browser can invoke these functions with the anon key.
revoke all on function consume_auth_attempt(text) from public, anon, authenticated;
revoke all on function clear_auth_attempts(text) from public, anon, authenticated;
revoke all on function claim_user(uuid,text,text,text) from public, anon, authenticated;
revoke all on function reset_user_pin(uuid,text) from public, anon, authenticated;
revoke all on function create_plan_atomic(jsonb,uuid[]) from public, anon, authenticated;
revoke all on function create_travel_atomic(jsonb,uuid[],jsonb,boolean) from public, anon, authenticated;
revoke all on function create_poll_atomic(text,text[],uuid) from public, anon, authenticated;
revoke all on function vote_poll_secure(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function consume_auth_attempt(text) to service_role;
grant execute on function clear_auth_attempts(text) to service_role;
grant execute on function claim_user(uuid,text,text,text) to service_role;
grant execute on function reset_user_pin(uuid,text) to service_role;
grant execute on function create_plan_atomic(jsonb,uuid[]) to service_role;
grant execute on function create_travel_atomic(jsonb,uuid[],jsonb,boolean) to service_role;
grant execute on function create_poll_atomic(text,text[],uuid) to service_role;
grant execute on function vote_poll_secure(uuid,uuid,uuid) to service_role;

create or replace function add_shopping_atomic(
  p_item text, p_quantity integer, p_category text, p_created_by uuid, p_claimed_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare item_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_category)) || ':' || lower(trim(p_item)), 0));
  select id into item_id from shopping_items
  where completed = false and category = p_category and lower(trim(item)) = lower(trim(p_item))
  order by created_at limit 1 for update;
  if item_id is null then
    insert into shopping_items (item, quantity, category, created_by, claimed_by)
    values (trim(p_item), greatest(1, p_quantity), p_category, p_created_by, p_claimed_by)
    returning id into item_id;
  else
    update shopping_items set
      quantity = quantity + greatest(1, p_quantity),
      claimed_by = coalesce(claimed_by, p_claimed_by)
    where id = item_id;
  end if;
  return item_id;
end;
$$;

create or replace function set_shopping_done_atomic(p_id uuid, p_done boolean, p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  update shopping_items set
    completed = p_done,
    completed_at = case when p_done then now() else null end,
    claimed_by = case when p_done then coalesce(claimed_by, p_user_id) else claimed_by end
  where id = p_id
$$;

create or replace function set_task_done_atomic(p_id uuid, p_done boolean, p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  update tasks set
    completed = p_done,
    completed_at = case when p_done then now() else null end,
    assigned_to = case when p_done then coalesce(assigned_to, p_user_id) else assigned_to end
  where id = p_id
$$;

revoke all on function add_shopping_atomic(text,integer,text,uuid,uuid) from public, anon, authenticated;
revoke all on function set_shopping_done_atomic(uuid,boolean,uuid) from public, anon, authenticated;
revoke all on function set_task_done_atomic(uuid,boolean,uuid) from public, anon, authenticated;
grant execute on function add_shopping_atomic(text,integer,text,uuid,uuid) to service_role;
grant execute on function set_shopping_done_atomic(uuid,boolean,uuid) to service_role;
grant execute on function set_task_done_atomic(uuid,boolean,uuid) to service_role;

create or replace function add_info_atomic(
  p_category text, p_title text, p_content text, p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
declare v_sort integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_category)), 0));
  select coalesce(max(sort_order), -1) + 1 into v_sort
  from important_info where category = p_category;
  insert into important_info (category, title, content, sort_order, created_by, updated_by)
  values (p_category, p_title, p_content, v_sort, p_created_by, p_created_by)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function add_announcement_atomic(
  p_title text, p_content text, p_pinned boolean, p_expires_at timestamptz, p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('announcements:pinned', 0));
  if p_pinned then
    update announcements set is_pinned = false where is_pinned = true;
  end if;
  insert into announcements (title, content, is_pinned, expires_at, created_by)
  values (p_title, p_content, p_pinned, p_expires_at, p_created_by)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function set_announcement_pinned_atomic(p_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('announcements:pinned', 0));
  if p_pinned then
    update announcements set is_pinned = false where is_pinned = true;
  end if;
  update announcements set is_pinned = p_pinned where id = p_id;
end;
$$;

with ranked as (
  select id, row_number() over (order by created_at desc, id) as position
  from announcements where is_pinned = true
)
update announcements set is_pinned = false
where id in (select id from ranked where position > 1);
create unique index if not exists announcements_one_pinned_idx
  on announcements ((is_pinned)) where is_pinned = true;

revoke all on function add_info_atomic(text,text,text,uuid) from public, anon, authenticated;
revoke all on function add_announcement_atomic(text,text,boolean,timestamptz,uuid) from public, anon, authenticated;
revoke all on function set_announcement_pinned_atomic(uuid,boolean) from public, anon, authenticated;
grant execute on function add_info_atomic(text,text,text,uuid) to service_role;
grant execute on function add_announcement_atomic(text,text,boolean,timestamptz,uuid) to service_role;
grant execute on function set_announcement_pinned_atomic(uuid,boolean) to service_role;
