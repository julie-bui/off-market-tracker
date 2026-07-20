-- Store specs as plain text instead of JSON wrappers like {"text":"..."}.

alter table public.properties
  alter column specs drop default;

alter table public.properties
  alter column specs type text
  using (
    case
      when specs is null then null
      when specs = '{}'::jsonb then null
      when jsonb_typeof(specs) = 'string' then nullif(specs #>> '{}', '')
      when jsonb_typeof(specs) = 'object' and (specs ? 'text')
        then nullif(specs ->> 'text', '')
      else nullif(trim(both '"' from specs::text), '')
    end
  );
