-- Require authenticated users for properties, property_files, and storage.
-- App sign-up/login uses Supabase Auth email+password.

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------

drop policy if exists "Public read properties" on public.properties;
drop policy if exists "Public insert properties" on public.properties;
drop policy if exists "Public update properties" on public.properties;
drop policy if exists "Public delete properties" on public.properties;

create policy "Authenticated read properties"
  on public.properties for select
  to authenticated
  using (auth.uid() is not null);

create policy "Authenticated insert properties"
  on public.properties for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "Authenticated update properties"
  on public.properties for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "Authenticated delete properties"
  on public.properties for delete
  to authenticated
  using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- property_files
-- ---------------------------------------------------------------------------

drop policy if exists "Public read property_files" on public.property_files;
drop policy if exists "Public insert property_files" on public.property_files;
drop policy if exists "Public update property_files" on public.property_files;
drop policy if exists "Public delete property_files" on public.property_files;

create policy "Authenticated read property_files"
  on public.property_files for select
  to authenticated
  using (auth.uid() is not null);

create policy "Authenticated insert property_files"
  on public.property_files for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "Authenticated update property_files"
  on public.property_files for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "Authenticated delete property_files"
  on public.property_files for delete
  to authenticated
  using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- storage: brochures + images
-- ---------------------------------------------------------------------------

drop policy if exists "Public read brochures" on storage.objects;
drop policy if exists "Public upload brochures" on storage.objects;
drop policy if exists "Public update brochures" on storage.objects;
drop policy if exists "Public delete brochures" on storage.objects;

drop policy if exists "Public read images" on storage.objects;
drop policy if exists "Public upload images" on storage.objects;
drop policy if exists "Public update images" on storage.objects;
drop policy if exists "Public delete images" on storage.objects;

create policy "Authenticated read brochures"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'brochures' and auth.uid() is not null);

create policy "Authenticated upload brochures"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'brochures' and auth.uid() is not null);

create policy "Authenticated update brochures"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'brochures' and auth.uid() is not null)
  with check (bucket_id = 'brochures' and auth.uid() is not null);

create policy "Authenticated delete brochures"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'brochures' and auth.uid() is not null);

create policy "Authenticated read images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'images' and auth.uid() is not null);

create policy "Authenticated upload images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'images' and auth.uid() is not null);

create policy "Authenticated update images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'images' and auth.uid() is not null)
  with check (bucket_id = 'images' and auth.uid() is not null);

create policy "Authenticated delete images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'images' and auth.uid() is not null);
