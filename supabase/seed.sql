-- Seed for Zim 2026.
--
-- The demo family and its content have been removed. Real people are
-- provisioned as "pending" identities (see scripts/provision-users.mjs) and
-- claim themselves in the app by choosing an emoji and PIN. This file only
-- seeds the app's own settings row.

insert into app_settings (id, app_title, wedding_date, wedding_url)
values (true, 'Zim 2026', '2026-09-12', 'https://example.com/wedding')
on conflict (id) do nothing;

-- Demo flights: two clearly-labelled "Demo Air" legs mid-flight, one whose
-- position is driven by live radar (OpenSky) and one on the schedule estimate,
-- so the flight card's Live vs Estimated badge can be demonstrated. Kept in as
-- a demo. Remove with: node scripts/seed-demo-flight.mjs --remove
insert into travel_groups (id, title, status, general_notes) values
  ('d3110000-0000-4000-8000-000000000001', '🧪 Demo — live tracking', 'travelling', 'Demo data.'),
  ('d3110000-0000-4000-8000-000000000002', '🧪 Demo — estimated', 'travelling', 'Demo data.')
on conflict (id) do nothing;

insert into flight_legs (
  id, travel_group_id, leg_order, provider, flight_number, airline_code, airline_name,
  origin_airport, origin_city, destination_airport, destination_city,
  scheduled_departure, estimated_departure, actual_departure, scheduled_arrival, estimated_arrival,
  aircraft_type, aircraft_type_code, aircraft_registration, status, progress, progress_source, delay_minutes
) values
  ('d3110000-0000-4000-8000-00000000000a', 'd3110000-0000-4000-8000-000000000001', 0, 'demo', 'DZ100', 'DZ', 'Demo Air',
   'DXB', 'Dubai', 'HRE', 'Harare',
   now() - interval '3.2 hours', now() - interval '3.2 hours', now() - interval '3.1 hours', now() + interval '1.4 hours', now() + interval '1.4 hours',
   'Boeing 777-300ER', 'B77W', 'DZ-DEMO', 'air', 0.62, 'live', 0),
  ('d3110000-0000-4000-8000-00000000000b', 'd3110000-0000-4000-8000-000000000002', 0, 'demo', 'DZ200', 'DZ', 'Demo Air',
   'JNB', 'Johannesburg', 'HRE', 'Harare',
   now() - interval '3.2 hours', now() - interval '3.2 hours', now() - interval '3.1 hours', now() + interval '1.4 hours', now() + interval '1.4 hours',
   'Boeing 777-300ER', 'B77W', 'DZ-DEMO', 'air', 0.38, 'estimated', 0)
on conflict (id) do nothing;
