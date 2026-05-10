-- Store real team work material used to generate contextual application pipelines.

create table if not exists public.mission_work_samples (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  sample_type text not null default 'real_team_material'
    check (sample_type in ('task', 'client_case', 'code', 'process', 'mission_example', 'business_situation', 'real_team_material', 'other')),
  status public.document_status not null default 'uploaded',
  storage_bucket text not null default 'mission-work-samples',
  file_name text not null,
  file_path text not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  extracted_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, file_path)
);

create index if not exists mission_work_samples_mission_idx
  on public.mission_work_samples(company_id, mission_id, created_at desc);

alter table public.mission_work_samples enable row level security;

drop trigger if exists set_mission_work_samples_updated_at on public.mission_work_samples;
create trigger set_mission_work_samples_updated_at
  before update on public.mission_work_samples
  for each row execute function public.set_updated_at();

drop policy if exists "mission_work_samples_select_company" on public.mission_work_samples;
create policy "mission_work_samples_select_company"
  on public.mission_work_samples for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "mission_work_samples_insert_recruiters" on public.mission_work_samples;
create policy "mission_work_samples_insert_recruiters"
  on public.mission_work_samples for insert to authenticated
  with check (company_id = public.current_company_id() and public.can_recruit());

drop policy if exists "mission_work_samples_update_recruiters" on public.mission_work_samples;
create policy "mission_work_samples_update_recruiters"
  on public.mission_work_samples for update to authenticated
  using (company_id = public.current_company_id() and public.can_recruit())
  with check (company_id = public.current_company_id());

drop policy if exists "mission_work_samples_delete_admins" on public.mission_work_samples;
create policy "mission_work_samples_delete_admins"
  on public.mission_work_samples for delete to authenticated
  using (company_id = public.current_company_id() and public.is_company_admin());

grant select, insert, update, delete on public.mission_work_samples to authenticated;
grant all on public.mission_work_samples to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mission-work-samples',
  'mission-work-samples',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/json',
    'application/javascript',
    'application/xml',
    'application/yaml',
    'application/octet-stream',
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/javascript',
    'text/typescript',
    'text/x-python',
    'text/x-sql',
    'text/html',
    'text/css',
    'text/xml',
    'text/yaml'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mission_work_samples_storage_select" on storage.objects;
create policy "mission_work_samples_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'mission-work-samples'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

drop policy if exists "mission_work_samples_storage_insert" on storage.objects;
create policy "mission_work_samples_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'mission-work-samples'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.can_recruit()
  );

drop policy if exists "mission_work_samples_storage_update" on storage.objects;
create policy "mission_work_samples_storage_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'mission-work-samples'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.can_recruit()
  )
  with check (
    bucket_id = 'mission-work-samples'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

drop policy if exists "mission_work_samples_storage_delete" on storage.objects;
create policy "mission_work_samples_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'mission-work-samples'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.is_company_admin()
  );
