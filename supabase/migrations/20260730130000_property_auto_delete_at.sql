-- Auto-delete properties after a set date (default: 3 months from create/save).

alter table public.properties
  add column if not exists auto_delete_at timestamptz;

-- Existing rows: delete 3 months after they were created.
update public.properties
set auto_delete_at = created_at + interval '3 months'
where auto_delete_at is null;

alter table public.properties
  alter column auto_delete_at set default (now() + interval '3 months');

alter table public.properties
  alter column auto_delete_at set not null;

create index if not exists properties_auto_delete_at_idx
  on public.properties (auto_delete_at);
