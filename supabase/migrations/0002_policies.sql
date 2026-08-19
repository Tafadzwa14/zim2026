-- Row Level Security (spec section 49).
--
-- Model: identity is custom (not Supabase Auth), so the anon key cannot be
-- tied to a DB role per user. Therefore:
--   * ALL writes go through server actions using the service-role key, which
--     bypasses RLS, AFTER the server verifies identity and permissions.
--   * The browser only ever READS, and only the non-sensitive shared tables,
--     so Realtime works. The users base table (with pin_hash) stays locked;
--     the browser reads people through the users_public view instead.

-- Public projection of users — never exposes pin_hash.
create or replace view users_public as
  select id, name, username, emoji, is_admin, status, created_at, updated_at
  from users;

-- Enable RLS everywhere.
alter table users            enable row level security;
alter table plans            enable row level security;
alter table plan_attendees   enable row level security;
alter table travel_groups    enable row level security;
alter table travel_group_members enable row level security;
alter table flight_legs      enable row level security;
alter table pickups          enable row level security;
alter table shopping_items   enable row level security;
alter table tasks            enable row level security;
alter table important_info   enable row level security;
alter table announcements    enable row level security;
alter table activity         enable row level security;
alter table app_settings     enable row level security;

-- users base table: no anon policy => browser cannot read it (pin_hash stays private).
-- The service role bypasses RLS for server-side reads/writes.

-- Read-only anon access to the shared family tables (private URL is convenience,
-- not authorization — spec section 49). No insert/update/delete policies exist,
-- so the anon key cannot write; writes happen server-side via the service role.
do $$
declare t text;
begin
  foreach t in array array[
    'plans','plan_attendees','travel_groups','travel_group_members','flight_legs',
    'pickups','shopping_items','tasks','important_info','announcements','activity','app_settings'
  ] loop
    execute format('drop policy if exists %I on %I;', t || '_read', t);
    execute format('create policy %I on %I for select using (true);', t || '_read', t);
    execute format('grant select on %I to anon, authenticated;', t);
  end loop;
end $$;

-- Expose the public view to the browser.
grant select on users_public to anon, authenticated;

-- Realtime: publish the collaborative tables so clients get live updates
-- (spec section 46). Wrapped so re-running the migration is safe.
do $$
declare t text;
begin
  foreach t in array array[
    'plans','plan_attendees','travel_groups','flight_legs',
    'pickups','shopping_items','tasks','announcements','activity'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
