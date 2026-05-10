-- Add public mission application links backed by private candidate sessions.

alter table public.missions
  add column if not exists public_slug text,
  add column if not exists apply_enabled boolean not null default false,
  add column if not exists pipeline_generation_mode text not null default 'dynamic';

update public.missions
set public_slug = coalesce(
  nullif(trim(both '-' from lower(regexp_replace(coalesce(title, 'mission'), '[^a-z0-9]+', '-', 'g'))), ''),
  'mission'
) || '-' || substr(replace(id::text, '-', ''), 1, 8)
where public_slug is null or public_slug = '';

update public.missions
set apply_enabled = case lower(metadata->>'candidate_link_enabled')
  when 'true' then true
  when 'false' then false
  else apply_enabled
end;

alter table public.missions
  alter column public_slug set not null,
  alter column apply_enabled set not null,
  alter column pipeline_generation_mode set not null;

alter table public.missions
  drop constraint if exists missions_public_slug_format;

alter table public.missions
  add constraint missions_public_slug_format
  check (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

alter table public.missions
  drop constraint if exists missions_pipeline_generation_mode_check;

alter table public.missions
  add constraint missions_pipeline_generation_mode_check
  check (pipeline_generation_mode in ('fixed', 'dynamic'));

create unique index if not exists missions_public_slug_unique_idx
  on public.missions(lower(public_slug));

create index if not exists missions_public_apply_idx
  on public.missions(apply_enabled, public_slug)
  where apply_enabled = true;
