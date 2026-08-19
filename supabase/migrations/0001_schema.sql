-- Zim 2026 schema (spec section 44). Run in the Supabase SQL editor or via
-- the Supabase CLI. Identity is custom (username + hashed PIN), not Supabase Auth.

create extension if not exists pgcrypto;

-- keep updated_at fresh
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text not null,
  emoji text not null,
  pin_hash text not null,
  is_admin boolean not null default false,
  status text not null default 'here' check (status in ('upcoming','travelling','here')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_username_lower_idx on users (lower(username));
create trigger users_updated before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- plans
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'family'
    check (category in ('travel','family','wedding','dinner','shopping','transport','social','important')),
  date date not null,
  start_time time,
  location text,
  anyone_can_join boolean not null default true,
  created_by uuid not null references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger plans_updated before update on plans
  for each row execute function set_updated_at();

create table if not exists plan_attendees (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  added_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (plan_id, user_id)
);

-- ---------------------------------------------------------------- travel
create table if not exists travel_groups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'upcoming' check (status in ('upcoming','travelling','arrived')),
  accommodation text,
  luggage_notes text,
  general_notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger travel_groups_updated before update on travel_groups
  for each row execute function set_updated_at();

create table if not exists travel_group_members (
  id uuid primary key default gen_random_uuid(),
  travel_group_id uuid not null references travel_groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  unique (travel_group_id, user_id)
);

create table if not exists flight_legs (
  id uuid primary key default gen_random_uuid(),
  travel_group_id uuid not null references travel_groups(id) on delete cascade,
  leg_order int not null default 0,
  provider text,
  provider_flight_id text,
  flight_number text not null,
  airline_code text,
  airline_name text,
  origin_airport text not null,
  origin_city text,
  destination_airport text not null,
  destination_city text,
  scheduled_departure timestamptz,
  estimated_departure timestamptz,
  actual_departure timestamptz,
  scheduled_arrival timestamptz,
  estimated_arrival timestamptz,
  actual_arrival timestamptz,
  terminal_departure text,
  gate_departure text,
  terminal_arrival text,
  gate_arrival text,
  aircraft_type text,
  aircraft_type_code text,
  aircraft_registration text,
  status text not null default 'scheduled'
    check (status in ('scheduled','boarding','air','landed','cancelled','diverted','unknown')),
  progress real,
  delay_minutes int,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists flight_legs_group_idx on flight_legs (travel_group_id);
create trigger flight_legs_updated before update on flight_legs
  for each row execute function set_updated_at();

create table if not exists pickups (
  id uuid primary key default gen_random_uuid(),
  travel_group_id uuid not null references travel_groups(id) on delete cascade,
  flight_leg_id uuid references flight_legs(id) on delete set null,
  requested boolean not null default true,
  driver_user_id uuid references users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (travel_group_id)
);
create trigger pickups_updated before update on pickups
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- logistics
create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  quantity int not null default 1,
  category text not null default 'Groceries',
  notes text,
  created_by uuid references users(id) on delete set null,
  claimed_by uuid references users(id) on delete set null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shopping_items_updated before update on shopping_items
  for each row execute function set_updated_at();

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  due_date date,
  due_time time,
  created_by uuid references users(id) on delete set null,
  assigned_to uuid references users(id) on delete set null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tasks_updated before update on tasks
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- info + comms
create table if not exists important_info (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  content text not null default '',
  sort_order int not null default 0,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger important_info_updated before update on important_info
  for each row execute function set_updated_at();

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  is_pinned boolean not null default false,
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger announcements_updated before update on announcements
  for each row execute function set_updated_at();

create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id) on delete set null,
  type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_created_idx on activity (created_at desc);

create table if not exists app_settings (
  id boolean primary key default true check (id),
  app_title text not null default 'Zim 2026',
  wedding_date date not null default '2026-09-12',
  wedding_url text not null default '',
  updated_at timestamptz not null default now()
);
create trigger app_settings_updated before update on app_settings
  for each row execute function set_updated_at();
