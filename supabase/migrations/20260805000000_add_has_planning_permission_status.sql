-- Add a new property status option.

alter type public.property_status add value if not exists 'has_planning_permission';
