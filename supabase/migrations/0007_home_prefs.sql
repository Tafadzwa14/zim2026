-- Per-person UI preferences (currently the customisable home layout).
-- `prefs.home.{mobile,desktop}` each hold { order: text[], hidden: text[] } of
-- widget ids; an empty object means "use the app defaults". Safe to re-run.

alter table users add column if not exists prefs jsonb not null default '{}'::jsonb;

-- Re-expose the public projection with the new non-sensitive column. New
-- columns must be appended at the END so CREATE OR REPLACE VIEW is happy
-- (it can add trailing columns but not reorder/rename existing ones).
create or replace view users_public as
  select id, name, username, emoji, is_admin, status, created_at, updated_at, roles, staying_at, prefs
  from users;
grant select on users_public to anon, authenticated;
