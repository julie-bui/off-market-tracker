-- Add available floor(s) text field for property listings.

alter table public.properties
  add column if not exists available_floors text;
