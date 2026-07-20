-- Unwrap any leftover {"text":"..."} specs values still stored as text.

update public.properties
set specs = nullif(trim(both from (specs::jsonb ->> 'text')), '')
where specs is not null
  and left(trim(specs), 1) = '{'
  and right(trim(specs), 1) = '}'
  and specs::jsonb ? 'text';
