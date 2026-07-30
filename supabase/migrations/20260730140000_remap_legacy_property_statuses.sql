-- Remap any legacy status values still stored as the old enum labels.
-- Safe to run even if the enum migration already succeeded (no-op when none match).

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'property_status'
      and e.enumlabel = 'available'
  ) then
    -- Old enum still present: run the full status migration path via cast through text.
    alter table public.properties alter column status drop default;

    if not exists (select 1 from pg_type where typname = 'property_status_v2') then
      create type public.property_status_v2 as enum (
        'coming_available_soon',
        'under_construction',
        'spacepoint_client',
        'undergoing_refurbishment'
      );
    end if;

    alter table public.properties
      alter column status type public.property_status_v2
      using (
        case status::text
          when 'available' then 'coming_available_soon'::public.property_status_v2
          when 'under_offer' then 'under_construction'::public.property_status_v2
          when 'let' then 'spacepoint_client'::public.property_status_v2
          when 'withdrawn' then 'undergoing_refurbishment'::public.property_status_v2
          when 'coming_available_soon' then 'coming_available_soon'::public.property_status_v2
          when 'under_construction' then 'under_construction'::public.property_status_v2
          when 'spacepoint_client' then 'spacepoint_client'::public.property_status_v2
          when 'undergoing_refurbishment' then 'undergoing_refurbishment'::public.property_status_v2
          else 'coming_available_soon'::public.property_status_v2
        end
      );

    alter table public.properties
      alter column status set default 'coming_available_soon'::public.property_status_v2;

    drop type if exists public.property_status;
    alter type public.property_status_v2 rename to property_status;
  end if;
end $$;
