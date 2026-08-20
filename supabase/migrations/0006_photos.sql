-- Shared family photo gallery (Aug 2026).
--   * A public Storage bucket `photos` holds the image files.
--   * A `photos` metadata table records who uploaded what and when.
-- Anyone signed in can upload; anyone can view/download (private URL is
-- convenience, not authorization — same model as the other shared tables).

-- ---------------------------------------------------------------- bucket
-- Public read is served straight from the storage public endpoint, so no
-- storage.objects read policy is needed. Uploads go through server actions on
-- the service-role key, which bypasses storage RLS, so no insert policy is
-- needed either.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos', 'photos', true, 26214400,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------- metadata
create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  caption text,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists photos_created_idx on photos (created_at desc);

-- RLS: read-only anon access, mirroring the other shared tables. Writes go
-- through server actions on the service role.
alter table photos enable row level security;

do $$
begin
  drop policy if exists photos_read on photos;
  create policy photos_read on photos for select using (true);
  grant select on photos to anon, authenticated;
  begin
    alter publication supabase_realtime add table photos;
  exception when duplicate_object then null;
  end;
end $$;
