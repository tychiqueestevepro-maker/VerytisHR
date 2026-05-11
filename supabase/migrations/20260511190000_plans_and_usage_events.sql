-- ============================================================
-- Migration: Plans, Usage Events & Credit Enforcement
-- ============================================================

-- 1. Extend the company_plan enum with 'beta_access'
alter type public.company_plan add value if not exists 'beta_access';

-- 2. Extend usage_event_type with new granular events
alter type public.usage_event_type add value if not exists 'sourcing_profile_analyzed';
alter type public.usage_event_type add value if not exists 'linkedin_verified';
alter type public.usage_event_type add value if not exists 'linkedin_profile_verified';
alter type public.usage_event_type add value if not exists 'company_research_used';
alter type public.usage_event_type add value if not exists 'cv_parsed';
alter type public.usage_event_type add value if not exists 'pipeline_generated';
alter type public.usage_event_type add value if not exists 'pipeline_response_analyzed';
alter type public.usage_event_type add value if not exists 'application_analyzed';

-- 3. Plans lookup table
create table if not exists public.plans (
  id text primary key,
  label text not null,
  description text,
  max_recruiter_seats integer not null default 1,
  max_sourcing_flows integer not null default 2,
  max_application_flows integer not null default 2,
  max_sourcing_profiles integer not null default 50,
  max_sourcing_analyses integer not null default 50,
  max_linkedin_verifications integer not null default 50,
  max_company_researches integer not null default 20,
  max_applications integer not null default 75,
  max_cv_parses integer not null default 75,
  max_pipeline_generations integer not null default 4,
  max_application_analyses integer not null default 75,
  max_monthly_credits integer not null default 200,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed the Beta Access plan
insert into public.plans (
  id, label, description,
  max_recruiter_seats, max_sourcing_flows, max_application_flows,
  max_sourcing_profiles, max_sourcing_analyses,
  max_linkedin_verifications, max_company_researches,
  max_applications, max_cv_parses,
  max_pipeline_generations, max_application_analyses,
  max_monthly_credits,
  features
) values (
  'beta_access',
  'Beta Access',
  'Start with one recruiter seat and test both flows with your own data.',
  1, 2, 2,
  50, 50,
  50, 20,
  75, 75,
  4, 75,
  200,
  '["csv_import","results_export","basic_linkedin_verification"]'::jsonb
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  max_recruiter_seats = excluded.max_recruiter_seats,
  max_sourcing_flows = excluded.max_sourcing_flows,
  max_application_flows = excluded.max_application_flows,
  max_sourcing_profiles = excluded.max_sourcing_profiles,
  max_sourcing_analyses = excluded.max_sourcing_analyses,
  max_linkedin_verifications = excluded.max_linkedin_verifications,
  max_company_researches = excluded.max_company_researches,
  max_applications = excluded.max_applications,
  max_cv_parses = excluded.max_cv_parses,
  max_pipeline_generations = excluded.max_pipeline_generations,
  max_application_analyses = excluded.max_application_analyses,
  max_monthly_credits = excluded.max_monthly_credits,
  features = excluded.features;

-- 4. Migrate credits columns to numeric for fractional credits (e.g. 0.05)
alter table public.companies
  alter column credits_balance type numeric(10,4) using credits_balance::numeric(10,4);

alter table public.companies
  alter column credits_balance set default 0;

alter table public.credits
  alter column amount type numeric(10,4) using amount::numeric(10,4);

alter table public.credits
  alter column balance_after type numeric(10,4) using balance_after::numeric(10,4);

alter table public.usage_logs
  alter column credits_delta type numeric(10,4) using credits_delta::numeric(10,4);

-- 5. Usage Events table (granular per-action log)
create table if not exists public.usage_events (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  event_type public.usage_event_type not null,
  credits_used numeric(10,4) not null default 0 check (credits_used >= 0),
  mission_id uuid references public.missions(id) on delete set null,
  candidate_id uuid references public.candidates(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_company_created_idx
  on public.usage_events(company_id, created_at desc);
create index if not exists usage_events_company_type_idx
  on public.usage_events(company_id, event_type);
create index if not exists usage_events_company_type_created_idx
  on public.usage_events(company_id, event_type, created_at desc);

-- 5. Add plan_id reference to companies
alter table public.companies
  add column if not exists plan_id text references public.plans(id) on delete set null;

-- 7. Extend company_usage_limits with the new quota columns
alter table public.company_usage_limits
  add column if not exists max_recruiter_seats integer not null default 1 check (max_recruiter_seats >= 0),
  add column if not exists max_sourcing_flows integer not null default 2 check (max_sourcing_flows >= 0),
  add column if not exists max_application_flows integer not null default 2 check (max_application_flows >= 0),
  add column if not exists max_sourcing_profiles integer not null default 50 check (max_sourcing_profiles >= 0),
  add column if not exists max_sourcing_analyses integer not null default 50 check (max_sourcing_analyses >= 0),
  add column if not exists max_company_researches integer not null default 20 check (max_company_researches >= 0),
  add column if not exists max_applications integer not null default 75 check (max_applications >= 0),
  add column if not exists max_cv_parses integer not null default 75 check (max_cv_parses >= 0),
  add column if not exists max_application_analyses integer not null default 75 check (max_application_analyses >= 0),
  add column if not exists max_monthly_credits numeric(10,4) not null default 200 check (max_monthly_credits >= 0),
  add column if not exists initial_credits numeric(10,4) not null default 200,
  add column if not exists current_period_start timestamptz not null default date_trunc('month', now()),
  add column if not exists current_period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month');

-- 7. RLS for usage_events
alter table public.usage_events enable row level security;

drop policy if exists "usage_events_select_company" on public.usage_events;
create policy "usage_events_select_company"
  on public.usage_events for select to authenticated
  using (company_id = public.current_company_id());

-- 8. RLS for plans (public read)
alter table public.plans enable row level security;

drop policy if exists "plans_select_all" on public.plans;
create policy "plans_select_all"
  on public.plans for select to authenticated
  using (true);

-- 9. Grants
grant select on public.plans to authenticated, service_role;
grant all on public.plans to service_role;
grant select, insert on public.usage_events to authenticated;
grant all on public.usage_events to service_role;

-- 11. Auto-provision: when a company is created with plan = 'beta_access',
--     populate its limits from the plans table AND grant initial credits
create or replace function public.provision_company_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row public.plans;
  initial_credit_amount numeric(10,4) := 200;
begin
  if new.plan_id is null then
    return new;
  end if;

  -- Skip if plan_id hasn't actually changed (for UPDATE triggers)
  if TG_OP = 'UPDATE' and old.plan_id = new.plan_id then
    return new;
  end if;

  select * into plan_row from public.plans where id = new.plan_id;
  if not found then
    return new;
  end if;

  initial_credit_amount := plan_row.max_monthly_credits;

  -- Provision quota limits
  insert into public.company_usage_limits (
    company_id,
    max_missions,
    max_recruiter_seats,
    max_sourcing_flows,
    max_application_flows,
    max_sourcing_profiles,
    max_sourcing_analyses,
    max_linkedin_verifications,
    max_company_researches,
    max_applications,
    max_cv_parses,
    max_pipeline_generations,
    max_application_analyses,
    max_monthly_credits,
    initial_credits,
    current_period_start,
    current_period_end
  ) values (
    new.id,
    plan_row.max_sourcing_flows + plan_row.max_application_flows,
    plan_row.max_recruiter_seats,
    plan_row.max_sourcing_flows,
    plan_row.max_application_flows,
    plan_row.max_sourcing_profiles,
    plan_row.max_sourcing_analyses,
    plan_row.max_linkedin_verifications,
    plan_row.max_company_researches,
    plan_row.max_applications,
    plan_row.max_cv_parses,
    plan_row.max_pipeline_generations,
    plan_row.max_application_analyses,
    initial_credit_amount,
    initial_credit_amount,
    date_trunc('month', now()),
    date_trunc('month', now()) + interval '1 month'
  )
  on conflict (company_id) do update set
    max_missions = excluded.max_missions,
    max_recruiter_seats = excluded.max_recruiter_seats,
    max_sourcing_flows = excluded.max_sourcing_flows,
    max_application_flows = excluded.max_application_flows,
    max_sourcing_profiles = excluded.max_sourcing_profiles,
    max_sourcing_analyses = excluded.max_sourcing_analyses,
    max_linkedin_verifications = excluded.max_linkedin_verifications,
    max_company_researches = excluded.max_company_researches,
    max_applications = excluded.max_applications,
    max_cv_parses = excluded.max_cv_parses,
    max_pipeline_generations = excluded.max_pipeline_generations,
    max_application_analyses = excluded.max_application_analyses,
    max_monthly_credits = excluded.max_monthly_credits,
    updated_at = now();

  -- Grant initial credits to the company
  update public.companies
    set credits_balance = initial_credit_amount
    where id = new.id
      and credits_balance = 0;

  -- Record the credit grant transaction
  insert into public.credits (
    company_id,
    transaction_type,
    amount,
    balance_after,
    description
  ) values (
    new.id,
    'grant',
    initial_credit_amount,
    initial_credit_amount,
    'Initial ' || plan_row.label || ' plan credits'
  );

  return new;
end;
$$;

drop trigger if exists on_company_plan_changed on public.companies;
create trigger on_company_plan_changed
  after insert or update of plan_id on public.companies
  for each row execute function public.provision_company_plan_limits();
