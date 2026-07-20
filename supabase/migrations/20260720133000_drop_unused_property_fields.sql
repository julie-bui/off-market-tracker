-- Remove unused property fields from the schema.

drop index if exists public.properties_sector_idx;

alter table public.properties
  drop column if exists total_price,
  drop column if exists sector,
  drop column if exists tenure,
  drop column if exists lease_length;

drop type if exists public.property_sector;
