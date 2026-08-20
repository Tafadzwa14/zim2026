-- Feature additions (Aug 2026):
--   * pickups.driver_en_route  — driver's "I'm on my way" flag
--   * users.pin_reset_requested — someone asked an admin to reset their PIN
--   * polls / poll_options / poll_votes — lightweight family polls

alter table pickups add column if not exists driver_en_route boolean not null default false;
alter table users   add column if not exists pin_reset_requested boolean not null default false;

-- ---------------------------------------------------------------- polls
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  closed boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger polls_updated before update on polls
  for each row execute function set_updated_at();

create table if not exists poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create table if not exists poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  option_id uuid not null references poll_options(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);
create index if not exists poll_votes_poll_idx on poll_votes (poll_id);

-- RLS: read-only anon access, mirroring the other shared tables. Writes go
-- through server actions on the service role.
alter table polls        enable row level security;
alter table poll_options enable row level security;
alter table poll_votes   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['polls','poll_options','poll_votes'] loop
    execute format('drop policy if exists %I on %I;', t || '_read', t);
    execute format('create policy %I on %I for select using (true);', t || '_read', t);
    execute format('grant select on %I to anon, authenticated;', t);
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
