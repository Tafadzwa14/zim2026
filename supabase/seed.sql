-- Demo seed for Zim 2026 development (spec section 68). Safe to re-run.
-- NOTE: seeded users carry a placeholder pin_hash and cannot be reclaimed by
-- PIN; real people onboard through the app. Flight facts here are demo data.

insert into app_settings (id, app_title, wedding_date, wedding_url)
values (true, 'Zim 2026', '2026-09-12', 'https://example.com/wedding')
on conflict (id) do nothing;

-- family
insert into users (id, name, username, emoji, pin_hash, is_admin, status) values
  ('11111111-1111-1111-1111-111111111111','Taffie','taffie','🏎️','SEED',true,'here'),
  ('22222222-2222-2222-2222-222222222222','Tapiwa','tapiwa','😎','SEED',false,'here'),
  ('33333333-3333-3333-3333-333333333333','Zoe','zoe','🦋','SEED',false,'here'),
  ('44444444-4444-4444-4444-444444444444','Tatenda','tatenda','🦁','SEED',false,'here'),
  ('55555555-5555-5555-5555-555555555555','Pauline','pauline','🌸','SEED',false,'travelling'),
  ('66666666-6666-6666-6666-666666666666','Lloyd','lloyd','🕶️','SEED',false,'upcoming')
on conflict (id) do nothing;

-- travel: Pauline arriving on EK713, pickup needed
insert into travel_groups (id, title, status, general_notes, created_by) values
  ('a1111111-1111-1111-1111-111111111111','Pauline','travelling','Landing this evening','55555555-5555-5555-5555-555555555555')
on conflict (id) do nothing;
insert into travel_group_members (travel_group_id, user_id) values
  ('a1111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555')
on conflict do nothing;
insert into flight_legs (id, travel_group_id, leg_order, provider, flight_number, airline_code, airline_name,
  origin_airport, origin_city, destination_airport, destination_city,
  scheduled_departure, scheduled_arrival, estimated_arrival,
  terminal_departure, aircraft_type, aircraft_type_code, status, progress, delay_minutes)
values ('b1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111',0,'demo','EK713','EK','Emirates',
  'DXB','Dubai','HRE','Harare',
  '2026-09-02T13:26:00Z','2026-09-02T17:10:00Z','2026-09-02T17:14:00Z',
  '3','Boeing 777-300ER','B77W','scheduled',0,4)
on conflict (id) do nothing;
insert into pickups (travel_group_id, flight_leg_id, requested, driver_user_id) values
  ('a1111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111',true,'44444444-4444-4444-4444-444444444444')
on conflict (travel_group_id) do nothing;

-- travel: Taffie & Tapiwa already arrived
insert into travel_groups (id, title, status, created_by) values
  ('a2222222-2222-2222-2222-222222222222','Taffie & Tapiwa','arrived','11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;
insert into travel_group_members (travel_group_id, user_id) values
  ('a2222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111'),
  ('a2222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222')
on conflict do nothing;
insert into flight_legs (id, travel_group_id, leg_order, flight_number, airline_code, airline_name,
  origin_airport, origin_city, destination_airport, destination_city,
  scheduled_departure, scheduled_arrival, aircraft_type, aircraft_type_code, status, progress)
values ('b2222222-2222-2222-2222-222222222222','a2222222-2222-2222-2222-222222222222',0,'EK713','EK','Emirates',
  'DXB','Dubai','HRE','Harare','2026-08-15T09:05:00Z','2026-08-15T13:10:00Z','Boeing 777-300ER','B77W','landed',1)
on conflict (id) do nothing;

-- plans
insert into plans (id, title, category, date, start_time, location, anyone_can_join, created_by) values
  ('c1111111-1111-1111-1111-111111111111','Big Family Dinner','dinner','2026-09-05','19:00','Gogo''s place',true,'33333333-3333-3333-3333-333333333333'),
  ('c2222222-2222-2222-2222-222222222222','Wedding shopping','shopping','2026-09-06','10:00','Sam Levy Village',true,'11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;
insert into plan_attendees (plan_id, user_id, added_by) values
  ('c1111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333'),
  ('c1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333'),
  ('c2222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111')
on conflict do nothing;

-- shopping + tasks
insert into shopping_items (item, quantity, category, created_by, claimed_by, completed) values
  ('Coke',4,'Groceries','22222222-2222-2222-2222-222222222222',null,false),
  ('Beef',3,'Groceries','33333333-3333-3333-3333-333333333333',null,false),
  ('Ice',5,'Groceries','33333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333',true),
  ('Extra chairs',10,'House','44444444-4444-4444-4444-444444444444',null,false)
on conflict do nothing;
insert into tasks (title, due_date, created_by, assigned_to, completed) values
  ('Pick up drinks','2026-09-05','11111111-1111-1111-1111-111111111111',null,false),
  ('Collect cake','2026-09-06','33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',true)
on conflict do nothing;

-- info + announcement
insert into important_info (category, title, content, sort_order) values
  ('Emergency','Ambulance','994',0),
  ('Emergency','Police','995',1),
  ('Home / Base','Address','12 Fairway Close, Borrowdale',0),
  ('Home / Base','Wi-Fi','ZimHouse2026',1),
  ('Wedding','Ceremony','Sat 12 September, 11:00 AM',0),
  ('Transport','Driver — Farai','+263 71 998 7744',0)
on conflict do nothing;
insert into announcements (title, content, is_pinned, created_by) values
  ('Tailor coming tomorrow at 10 AM','Final fittings at the house — be ready.',true,'11111111-1111-1111-1111-111111111111')
on conflict do nothing;
