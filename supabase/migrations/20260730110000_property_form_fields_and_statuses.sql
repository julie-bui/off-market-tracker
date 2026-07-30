-- Replace property statuses and add company / building / floor fields.

alter table public.properties
  add column if not exists company text,
  add column if not exists building text,
  add column if not exists floor text;

create type public.property_status_v2 as enum (
  'coming_available_soon',
  'under_construction',
  'spacepoint_client',
  'undergoing_refurbishment'
);

alter table public.properties
  alter column status drop default;

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

drop type public.property_status;

alter type public.property_status_v2 rename to property_status;
