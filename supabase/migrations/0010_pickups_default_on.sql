-- Harare arrivals require a pickup by default. Keep a row with requested=false
-- when someone explicitly opts out so that the disabled choice is durable.

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

    if upper(trim(leg->>'destination_airport')) = 'HRE' then
      insert into pickups (travel_group_id, flight_leg_id, requested)
      values (v_group_id, v_leg_id, coalesce(p_pickup, true));
    end if;
  end loop;
  return v_group_id;
end;
$$;

-- Existing Harare arrivals predate the default-on rule. Missing rows were not
-- durable opt-outs, so make those pickups required without touching existing
-- requested=false rows or driver assignments.
insert into pickups (travel_group_id, flight_leg_id, requested)
select l.travel_group_id, l.id, true
from flight_legs l
where upper(trim(l.destination_airport)) = 'HRE'
on conflict (flight_leg_id) do nothing;

revoke all on function create_travel_atomic(jsonb,uuid[],jsonb,boolean) from public, anon, authenticated;
grant execute on function create_travel_atomic(jsonb,uuid[],jsonb,boolean) to service_role;
