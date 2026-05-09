-- Add candidate lists support
create table if not exists public.candidate_lists (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.candidates add column if not exists list_id uuid references public.candidate_lists(id) on delete set null;

create index if not exists candidates_list_id_idx on public.candidates(list_id);

-- Trigger for updated_at
create trigger set_candidate_lists_updated_at before update on public.candidate_lists for each row execute function public.set_updated_at();

-- RLS
alter table public.candidate_lists enable row level security;

create policy "Users can view lists in their company"
  on public.candidate_lists for select
  using (company_id = public.current_company_id());

create policy "Users can manage lists in their company"
  on public.candidate_lists for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
