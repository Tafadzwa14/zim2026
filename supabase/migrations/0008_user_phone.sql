-- Phone numbers for the family roster (Aug 2026).
--
-- Deliberately NOT added to the users_public view. That view is granted to
-- anon and authenticated, so anything on it is world-readable to anyone
-- holding the anon key. Phone numbers are read server-side with the service
-- role only, and are only ever rendered to admins. Safe to re-run.

alter table users add column if not exists phone_number text;
