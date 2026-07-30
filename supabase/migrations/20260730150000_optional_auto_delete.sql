-- Allow properties to opt out of auto-delete (keep forever).

alter table public.properties
  alter column auto_delete_at drop not null;

alter table public.properties
  alter column auto_delete_at drop default;
