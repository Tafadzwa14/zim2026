-- Admin control-centre: roles + per-person location on users, and a reusable
-- places list. Safe to re-run.

-- Roles (e.g. 'driver') and where a person is staying.
alter table users add column if not exists roles text[] not null default '{}';
alter table users add column if not exists staying_at text;

-- Re-expose the public projection with the new non-sensitive columns.
-- New columns must be appended at the END so CREATE OR REPLACE VIEW is happy
-- (it can add trailing columns but not reorder/rename existing ones).
create or replace view users_public as
  select id, name, username, emoji, is_admin, status, created_at, updated_at, roles, staying_at
  from users;
grant select on users_public to anon, authenticated;

-- Reusable venues, admin-managed, used as plan locations.
create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  notes text,
  sort_order int not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists places_updated on places;
create trigger places_updated before update on places
  for each row execute function set_updated_at();

-- RLS: browser reads only; writes go through the service role server-side.
alter table places enable row level security;
drop policy if exists places_read on places;
create policy places_read on places for select using (true);
grant select on places to anon, authenticated;

-- Realtime for live place updates.
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table places';
  exception when duplicate_object then null;
  end;
end $$;
