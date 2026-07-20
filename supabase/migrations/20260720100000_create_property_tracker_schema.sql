-- Off-market property tracker schema
-- Open access: no authentication required

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.property_status as enum (
  'available',
  'under_offer',
  'let',
  'withdrawn'
);

create type public.property_file_type as enum (
  'brochure',
  'image'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  postcode text,
  latitude double precision,
  longitude double precision,
  size_sqft numeric,
  cost_per_sqft numeric,
  availability_period text,
  status public.property_status not null default 'available',
  agent_name text,
  agent_phone text,
  agent_email text,
  specs text,
  notes text,
  created_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now()
);

create table public.property_files (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  file_url text not null,
  file_type public.property_file_type not null,
  created_at timestamptz not null default now()
);

create index property_files_property_id_idx on public.property_files (property_id);
create index property_files_file_type_idx on public.property_files (file_type);
create index properties_status_idx on public.properties (status);
create index properties_postcode_idx on public.properties (postcode);

-- Keep last_updated_at in sync on row updates
create or replace function public.set_last_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.last_updated_at = now();
  return new;
end;
$$;

create trigger properties_set_last_updated_at
before update on public.properties
for each row
execute function public.set_last_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — open access (anon + authenticated)
-- ---------------------------------------------------------------------------

alter table public.properties enable row level security;
alter table public.property_files enable row level security;

create policy "Public read properties"
  on public.properties for select
  to anon, authenticated
  using (true);

create policy "Public insert properties"
  on public.properties for insert
  to anon, authenticated
  with check (true);

create policy "Public update properties"
  on public.properties for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Public delete properties"
  on public.properties for delete
  to anon, authenticated
  using (true);

create policy "Public read property_files"
  on public.property_files for select
  to anon, authenticated
  using (true);

create policy "Public insert property_files"
  on public.property_files for insert
  to anon, authenticated
  with check (true);

create policy "Public update property_files"
  on public.property_files for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Public delete property_files"
  on public.property_files for delete
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Storage buckets: brochure PDFs + property images
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'brochures',
    'brochures',
    true,
    52428800, -- 50 MB
    array['application/pdf']::text[]
  ),
  (
    'images',
    'images',
    true,
    10485760, -- 10 MB
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  );

-- Open access storage policies
create policy "Public read brochures"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'brochures');

create policy "Public upload brochures"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'brochures');

create policy "Public update brochures"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'brochures')
  with check (bucket_id = 'brochures');

create policy "Public delete brochures"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'brochures');

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
