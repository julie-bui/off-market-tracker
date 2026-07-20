-- Prefer the existing `images` bucket over the earlier `property-images` name.
-- Safe to run whether or not `property-images` was already created.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'images',
  'images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do nothing;

drop policy if exists "Public read property images" on storage.objects;
drop policy if exists "Public upload property images" on storage.objects;
drop policy if exists "Public update property images" on storage.objects;
drop policy if exists "Public delete property images" on storage.objects;

drop policy if exists "Public read images" on storage.objects;
drop policy if exists "Public upload images" on storage.objects;
drop policy if exists "Public update images" on storage.objects;
drop policy if exists "Public delete images" on storage.objects;

create policy "Public read images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'images');

create policy "Public upload images"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'images');

create policy "Public update images"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'images')
  with check (bucket_id = 'images');

create policy "Public delete images"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'images');
