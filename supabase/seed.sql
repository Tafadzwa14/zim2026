-- Seed for Zim 2026.
--
-- The demo family and its content have been removed. Real people are
-- provisioned as "pending" identities (see scripts/provision-users.mjs) and
-- claim themselves in the app by choosing an emoji and PIN. This file only
-- seeds the app's own settings row.

insert into app_settings (id, app_title, wedding_date, wedding_url)
values (true, 'Zim 2026', '2026-09-12', 'https://example.com/wedding')
on conflict (id) do nothing;
