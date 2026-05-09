-- VerytisHR schema for a fresh Supabase/PostgreSQL database.
-- This baseline intentionally does not depend on the legacy Verytis AGNT CRM schema.

create schema if not exists extensions;

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext" with schema extensions;

do $$
begin
  create type public.company_plan as enum ('free', 'starter', 'pro', 'enterprise');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.company_status as enum ('active', 'suspended', 'archived');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.user_role as enum ('owner', 'admin', 'recruiter', 'reviewer', 'member');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.user_status as enum ('invited', 'active', 'suspended');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.mission_status as enum ('draft', 'open', 'paused', 'closed', 'archived');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.mission_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.employment_type as enum ('full_time', 'part_time', 'contract', 'internship', 'freelance', 'temporary');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.remote_policy as enum ('onsite', 'hybrid', 'remote');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.candidate_status as enum ('new', 'imported', 'screening', 'qualified', 'interviewing', 'offer', 'hired', 'rejected', 'archived');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.candidate_source as enum ('manual', 'linkedin', 'import', 'referral', 'application', 'agency', 'other');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.document_type as enum ('resume', 'cover_letter', 'portfolio', 'certificate', 'reference', 'transcript', 'other');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.document_status as enum ('uploaded', 'processing', 'parsed', 'failed');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.linkedin_verification_status as enum ('pending', 'verified', 'mismatch', 'not_found', 'error');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.score_type as enum ('fit', 'trust', 'experience', 'technical', 'culture', 'linkedin', 'pipeline', 'overall');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.score_level as enum ('low', 'medium', 'high', 'excellent');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.signal_type as enum ('positive', 'neutral', 'negative');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.signal_source as enum ('resume', 'linkedin', 'pipeline_response', 'manual', 'ai', 'other');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.inconsistency_severity as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.review_status as enum ('open', 'reviewed', 'ignored', 'resolved');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.pipeline_status as enum ('draft', 'active', 'paused', 'archived');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.pipeline_step_type as enum ('application', 'screening', 'interview', 'test', 'offer', 'custom');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.question_type as enum ('short_text', 'long_text', 'single_choice', 'multiple_choice', 'number', 'date', 'file', 'url', 'yes_no', 'rating');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.response_status as enum ('draft', 'submitted', 'reviewed', 'flagged');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.usage_event_type as enum ('ai_score', 'linkedin_verification', 'document_parse', 'pipeline_submit', 'pipeline_generation', 'pipeline_session_created', 'pipeline_response_analysis', 'candidate_import', 'candidate_export', 'mission_create', 'manual', 'other');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.credit_transaction_type as enum ('grant', 'purchase', 'usage', 'refund', 'adjustment', 'expiration');
exception when duplicate_object then null;
end;
$$;

alter type public.score_type add value if not exists 'trust';
alter type public.usage_event_type add value if not exists 'pipeline_generation';
alter type public.usage_event_type add value if not exists 'pipeline_session_created';
alter type public.usage_event_type add value if not exists 'pipeline_response_analysis';

create table if not exists public.companies (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug extensions.citext not null unique,
  legal_name text,
  website_url text,
  linkedin_url text,
  industry text,
  size_range text,
  country text,
  timezone text not null default 'Europe/Paris',
  locale text not null default 'fr',
  billing_email extensions.citext,
  plan public.company_plan not null default 'free',
  status public.company_status not null default 'active',
  credits_balance integer not null default 0 check (credits_balance >= 0),
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  email extensions.citext not null unique,
  first_name text,
  last_name text,
  avatar_url text,
  role public.user_role not null default 'member',
  status public.user_status not null default 'active',
  invited_by uuid references public.users(id) on delete set null,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  title text not null,
  department text,
  location text,
  remote_policy public.remote_policy,
  employment_type public.employment_type,
  status public.mission_status not null default 'draft',
  priority public.mission_priority not null default 'medium',
  headcount integer not null default 1 check (headcount > 0),
  salary_min integer check (salary_min is null or salary_min >= 0),
  salary_max integer check (salary_max is null or salary_max >= 0),
  salary_currency char(3) not null default 'EUR',
  description text,
  responsibilities text,
  requirements text,
  benefits text,
  target_start_date date,
  published_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missions_salary_range check (salary_min is null or salary_max is null or salary_max >= salary_min)
);

create table if not exists public.candidates (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  first_name text,
  last_name text,
  email extensions.citext,
  phone text,
  linkedin_url text,
  location text,
  country text,
  current_title text,
  current_company_name text,
  source public.candidate_source not null default 'manual',
  status public.candidate_status not null default 'new',
  stage text,
  tags text[] not null default '{}'::text[],
  summary text,
  notes text,
  consent_given boolean not null default false,
  consent_at timestamptz,
  applied_at timestamptz,
  last_contacted_at timestamptz,
  gdpr_deleted_at timestamptz,
  raw_profile jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_missions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  status public.candidate_status not null default 'new',
  stage text,
  fit_score numeric(5,2) check (fit_score is null or fit_score between 0 and 100),
  trust_score numeric(5,2) check (trust_score is null or trust_score between 0 and 100),
  recommendation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, mission_id)
);

create table if not exists public.candidate_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  uploaded_by uuid references public.users(id) on delete set null,
  document_type public.document_type not null default 'resume',
  status public.document_status not null default 'uploaded',
  storage_bucket text not null default 'candidate-cvs',
  file_name text not null,
  file_path text not null,
  file_url text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  extracted_text text,
  parsed_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, file_path)
);

create table if not exists public.linkedin_verifications (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  linkedin_url text not null,
  status public.linkedin_verification_status not null default 'pending',
  profile_name text,
  headline text,
  current_company text,
  location text,
  profile_image_url text,
  confidence_score numeric(5,2) check (confidence_score is null or confidence_score between 0 and 100),
  verification_data jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_scores (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  scored_by uuid references public.users(id) on delete set null,
  score_type public.score_type not null default 'fit',
  score numeric(5,2) not null check (score between 0 and 100),
  level public.score_level,
  criteria jsonb not null default '{}'::jsonb,
  explanation text,
  model_name text,
  scored_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_signals (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  score_id uuid references public.candidate_scores(id) on delete set null,
  signal_type public.signal_type not null,
  source public.signal_source not null default 'ai',
  category text,
  label text not null,
  description text,
  evidence text,
  weight numeric(6,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_inconsistencies (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  verification_id uuid references public.linkedin_verifications(id) on delete set null,
  document_id uuid references public.candidate_documents(id) on delete set null,
  severity public.inconsistency_severity not null default 'medium',
  field_name text not null,
  document_value text,
  linkedin_value text,
  observed_value text,
  expected_value text,
  description text not null,
  status public.review_status not null default 'open',
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pipelines (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  name text not null,
  description text,
  status public.pipeline_status not null default 'draft',
  is_default boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_extension_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  token_hash text not null unique,
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.pipeline_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  public_token uuid not null default extensions.gen_random_uuid() unique,
  status text not null default 'opened'
    check (status in ('opened', 'submitted', 'analyzed', 'failed', 'expired', 'cancelled')),
  expires_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  analyzed_at timestamptz,
  candidate_email extensions.citext,
  candidate_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pipeline_steps (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  position integer not null check (position >= 0),
  name text not null,
  description text,
  step_type public.pipeline_step_type not null default 'custom',
  is_required boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_id, position)
);

create table if not exists public.pipeline_questions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  step_id uuid references public.pipeline_steps(id) on delete cascade,
  position integer not null check (position >= 0),
  question_type public.question_type not null,
  label text not null,
  description text,
  placeholder text,
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  scoring_weight numeric(6,2) not null default 0,
  knockout boolean not null default false,
  validation_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipeline_questions_options_array check (jsonb_typeof(options) = 'array')
);

create table if not exists public.candidate_pipeline_responses (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  pipeline_session_id uuid not null references public.pipeline_sessions(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  step_id uuid references public.pipeline_steps(id) on delete set null,
  question_id uuid references public.pipeline_questions(id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number > 0),
  response_text text,
  response_json jsonb not null default '{}'::jsonb,
  file_document_id uuid references public.candidate_documents(id) on delete set null,
  score numeric(5,2) check (score is null or score between 0 and 100),
  status public.response_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pipeline_scores (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  pipeline_session_id uuid not null references public.pipeline_sessions(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  score numeric(5,2) not null check (score between 0 and 100),
  level public.score_level,
  analysis text,
  criteria jsonb not null default '{}'::jsonb,
  model_name text,
  created_at timestamptz not null default now(),
  unique (pipeline_session_id)
);

create table if not exists public.usage_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  mission_id uuid references public.missions(id) on delete set null,
  candidate_id uuid references public.candidates(id) on delete set null,
  event_type public.usage_event_type not null,
  credits_delta integer not null default 0,
  provider text,
  model_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.credits (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  transaction_type public.credit_transaction_type not null,
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  usage_log_id uuid references public.usage_logs(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.company_usage_limits (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  max_missions integer not null default 1 check (max_missions >= 0),
  max_candidates integer not null default 5000 check (max_candidates >= 0),
  max_linkedin_verifications integer not null default 50 check (max_linkedin_verifications >= 0),
  max_document_parses integer not null default 50 check (max_document_parses >= 0),
  max_pipeline_generations integer not null default 2 check (max_pipeline_generations >= 0),
  max_pipeline_sessions integer not null default 50 check (max_pipeline_sessions >= 0),
  max_pipeline_response_analyses integer not null default 50 check (max_pipeline_response_analyses >= 0),
  max_pipeline_responses integer not null default 100 check (max_pipeline_responses >= 0),
  reset_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.candidate_documents
  alter column storage_bucket set default 'candidate-cvs';

alter table if exists public.pipeline_sessions
  add column if not exists analyzed_at timestamptz;

alter table if exists public.pipeline_sessions
  alter column status set default 'opened';

update public.pipeline_sessions
set status = 'opened'
where status in ('active', 'started');

alter table if exists public.pipeline_sessions
  drop constraint if exists pipeline_sessions_status_check;

alter table if exists public.pipeline_sessions
  add constraint pipeline_sessions_status_check
  check (status in ('opened', 'submitted', 'analyzed', 'failed', 'expired', 'cancelled'));

alter table if exists public.company_usage_limits
  alter column max_pipeline_generations set default 2;

alter table if exists public.company_usage_limits
  alter column max_candidates set default 5000;

update public.company_usage_limits
set max_candidates = 5000
where max_candidates = 50;

alter table if exists public.company_usage_limits
  add column if not exists max_pipeline_sessions integer not null default 50 check (max_pipeline_sessions >= 0);

alter table if exists public.company_usage_limits
  add column if not exists max_pipeline_response_analyses integer not null default 50 check (max_pipeline_response_analyses >= 0);

create unique index if not exists candidates_company_email_unique
  on public.candidates(company_id, email)
  where email is not null;

create unique index if not exists candidates_company_linkedin_unique
  on public.candidates(company_id, linkedin_url)
  where linkedin_url is not null;

drop index if exists public.candidate_pipeline_responses_unique_attempt;
create unique index candidate_pipeline_responses_unique_attempt
  on public.candidate_pipeline_responses(pipeline_session_id, question_id, attempt_number)
  where question_id is not null;

create index if not exists companies_status_idx on public.companies(status);
create index if not exists users_company_id_idx on public.users(company_id);
create index if not exists users_role_idx on public.users(role);
create index if not exists missions_company_status_idx on public.missions(company_id, status);
create index if not exists missions_company_created_idx on public.missions(company_id, created_at desc);
create index if not exists candidates_company_status_idx on public.candidates(company_id, status);
create index if not exists candidates_tags_idx on public.candidates using gin(tags);
create index if not exists candidate_missions_company_idx on public.candidate_missions(company_id, mission_id, status);
create index if not exists candidate_missions_candidate_idx on public.candidate_missions(candidate_id);
create index if not exists candidate_documents_candidate_idx on public.candidate_documents(candidate_id, created_at desc);
create index if not exists linkedin_verifications_candidate_idx on public.linkedin_verifications(candidate_id, checked_at desc);
create index if not exists candidate_scores_candidate_idx on public.candidate_scores(candidate_id, mission_id, score_type, scored_at desc);
create index if not exists candidate_signals_candidate_idx on public.candidate_signals(candidate_id, signal_type);
create index if not exists candidate_inconsistencies_candidate_idx on public.candidate_inconsistencies(candidate_id, status, severity);
create index if not exists pipelines_company_status_idx on public.pipelines(company_id, status);
create index if not exists pipelines_mission_idx on public.pipelines(mission_id);
create index if not exists hr_extension_tokens_company_idx on public.hr_extension_tokens(company_id, status);
create index if not exists hr_extension_tokens_user_idx on public.hr_extension_tokens(user_id);
drop index if exists public.pipeline_sessions_one_open_per_candidate;
create unique index pipeline_sessions_one_open_per_candidate
  on public.pipeline_sessions(candidate_id, pipeline_id)
  where status = 'opened';
create index if not exists pipeline_sessions_company_idx on public.pipeline_sessions(company_id, status);
create index if not exists pipeline_sessions_token_idx on public.pipeline_sessions(public_token);
create index if not exists pipeline_sessions_candidate_idx on public.pipeline_sessions(candidate_id, pipeline_id);
create index if not exists pipeline_steps_pipeline_position_idx on public.pipeline_steps(pipeline_id, position);
create index if not exists pipeline_questions_pipeline_position_idx on public.pipeline_questions(pipeline_id, position);
create index if not exists pipeline_questions_step_position_idx on public.pipeline_questions(step_id, position);
create index if not exists candidate_pipeline_responses_candidate_idx on public.candidate_pipeline_responses(candidate_id, pipeline_id);
create index if not exists candidate_pipeline_responses_session_idx on public.candidate_pipeline_responses(pipeline_session_id);
create index if not exists pipeline_scores_company_idx on public.pipeline_scores(company_id, created_at desc);
create index if not exists pipeline_scores_session_idx on public.pipeline_scores(pipeline_session_id);
create index if not exists pipeline_scores_mission_idx on public.pipeline_scores(mission_id, score desc);
create index if not exists usage_logs_company_created_idx on public.usage_logs(company_id, created_at desc);
create index if not exists usage_logs_event_idx on public.usage_logs(event_type, created_at desc);
create index if not exists credits_company_created_idx on public.credits(company_id, created_at desc);
create index if not exists company_usage_limits_company_idx on public.company_usage_limits(company_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'companies',
    'users',
    'missions',
    'candidates',
    'candidate_missions',
    'candidate_documents',
    'candidate_inconsistencies',
    'pipelines',
    'pipeline_sessions',
    'pipeline_steps',
    'pipeline_questions',
    'candidate_pipeline_responses',
    'company_usage_limits'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      'set_' || table_name || '_updated_at',
      table_name
    );

    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.handle_new_company_usage_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_usage_limits (company_id)
  values (new.id)
  on conflict (company_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_company_created_usage_limits on public.companies;

create trigger on_company_created_usage_limits
  after insert on public.companies
  for each row execute function public.handle_new_company_usage_limits();

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.users
  where id = auth.uid()
    and status = 'active'
  limit 1
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users
  where id = auth.uid()
    and status = 'active'
  limit 1
$$;

create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('owner', 'admin'), false)
$$;

create or replace function public.can_recruit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('owner', 'admin', 'recruiter'), false)
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    first_name,
    last_name,
    avatar_url,
    status
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'avatar_url',
    'active'
  )
  on conflict (id) do update
    set email = excluded.email,
        first_name = coalesce(public.users.first_name, excluded.first_name),
        last_name = coalesce(public.users.last_name, excluded.last_name),
        avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.create_company_for_current_user(
  company_name text,
  company_slug text default null
)
returns public.companies
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email extensions.citext;
  normalized_slug text;
  created_company public.companies;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select email::extensions.citext
    into current_user_email
  from auth.users
  where id = current_user_id;

  normalized_slug := lower(regexp_replace(coalesce(company_slug, company_name), '[^a-z0-9]+', '-', 'g'));
  normalized_slug := trim(both '-' from normalized_slug);

  if normalized_slug = '' then
    normalized_slug := 'company';
  end if;

  if company_slug is null then
    normalized_slug := normalized_slug || '-' || substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8);
  end if;

  insert into public.companies (name, slug, created_by)
  values (company_name, normalized_slug, current_user_id)
  returning * into created_company;

  insert into public.users (id, company_id, email, role, status)
  values (current_user_id, created_company.id, current_user_email, 'owner', 'active')
  on conflict (id) do update
    set company_id = created_company.id,
        email = excluded.email,
        role = 'owner',
        status = 'active',
        updated_at = now();

  return created_company;
end;
$$;

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.missions enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_missions enable row level security;
alter table public.candidate_documents enable row level security;
alter table public.linkedin_verifications enable row level security;
alter table public.candidate_scores enable row level security;
alter table public.candidate_signals enable row level security;
alter table public.candidate_inconsistencies enable row level security;
alter table public.pipelines enable row level security;
alter table public.hr_extension_tokens enable row level security;
alter table public.pipeline_sessions enable row level security;
alter table public.pipeline_steps enable row level security;
alter table public.pipeline_questions enable row level security;
alter table public.candidate_pipeline_responses enable row level security;
alter table public.pipeline_scores enable row level security;
alter table public.usage_logs enable row level security;
alter table public.credits enable row level security;
alter table public.company_usage_limits enable row level security;

drop policy if exists "companies_select_own" on public.companies;
create policy "companies_select_own"
  on public.companies for select to authenticated
  using (id = public.current_company_id() or created_by = auth.uid());

drop policy if exists "users_select_company" on public.users;
create policy "users_select_company"
  on public.users for select to authenticated
  using (id = auth.uid() or company_id = public.current_company_id());

drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self"
  on public.users for insert to authenticated
  with check (id = auth.uid() and company_id is null and role = 'member' and status = 'active');

drop policy if exists "users_update_self_profile" on public.users;
create policy "users_update_self_profile"
  on public.users for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "usage_logs_select_company" on public.usage_logs;
create policy "usage_logs_select_company"
  on public.usage_logs for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "credits_select_company" on public.credits;
create policy "credits_select_company"
  on public.credits for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "company_usage_limits_select_company" on public.company_usage_limits;
create policy "company_usage_limits_select_company"
  on public.company_usage_limits for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "hr_extension_tokens_select_company" on public.hr_extension_tokens;
create policy "hr_extension_tokens_select_company"
  on public.hr_extension_tokens for select to authenticated
  using (company_id = public.current_company_id());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'missions',
    'candidates',
    'candidate_missions',
    'candidate_documents',
    'pipelines',
    'pipeline_sessions',
    'pipeline_steps',
    'pipeline_questions'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_company', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (company_id = public.current_company_id())',
      table_name || '_select_company',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_insert_recruiters', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (company_id = public.current_company_id() and public.can_recruit())',
      table_name || '_insert_recruiters',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_update_recruiters', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (company_id = public.current_company_id() and public.can_recruit()) with check (company_id = public.current_company_id())',
      table_name || '_update_recruiters',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_delete_admins', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (company_id = public.current_company_id() and public.is_company_admin())',
      table_name || '_delete_admins',
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'linkedin_verifications',
    'candidate_scores',
    'candidate_signals',
    'candidate_inconsistencies',
    'candidate_pipeline_responses',
    'pipeline_scores'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_company', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (company_id = public.current_company_id())',
      table_name || '_select_company',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists "candidate_inconsistencies_review_recruiters" on public.candidate_inconsistencies;
create policy "candidate_inconsistencies_review_recruiters"
  on public.candidate_inconsistencies for update to authenticated
  using (company_id = public.current_company_id() and public.can_recruit())
  with check (company_id = public.current_company_id());

drop policy if exists "candidate_pipeline_responses_review_recruiters" on public.candidate_pipeline_responses;
create policy "candidate_pipeline_responses_review_recruiters"
  on public.candidate_pipeline_responses for update to authenticated
  using (company_id = public.current_company_id() and public.can_recruit())
  with check (company_id = public.current_company_id());

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.companies from authenticated;
revoke update, delete on public.users from authenticated;
revoke insert, update, delete on public.hr_extension_tokens from authenticated;
revoke insert, update, delete on public.linkedin_verifications from authenticated;
revoke insert, update, delete on public.candidate_scores from authenticated;
revoke insert, update, delete on public.candidate_signals from authenticated;
revoke insert, update, delete on public.candidate_inconsistencies from authenticated;
revoke insert, update, delete on public.candidate_pipeline_responses from authenticated;
revoke insert, update, delete on public.pipeline_scores from authenticated;
grant update(first_name, last_name, avatar_url, metadata, last_seen_at, updated_at) on public.users to authenticated;
grant update(status, reviewed_by, reviewed_at, updated_at)
  on public.candidate_inconsistencies to authenticated;
grant update(status, reviewed_by, reviewed_at, score, updated_at)
  on public.candidate_pipeline_responses to authenticated;
grant execute on function public.current_company_id() to authenticated, service_role;
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_company_admin() to authenticated, service_role;
grant execute on function public.can_recruit() to authenticated, service_role;
grant execute on function public.create_company_for_current_user(text, text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-cvs',
  'candidate-cvs',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'text/plain'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "candidate_documents_storage_select" on storage.objects;
create policy "candidate_documents_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

drop policy if exists "candidate_documents_storage_insert" on storage.objects;
create policy "candidate_documents_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.can_recruit()
  );

drop policy if exists "candidate_documents_storage_update" on storage.objects;
create policy "candidate_documents_storage_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.can_recruit()
  )
  with check (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

drop policy if exists "candidate_documents_storage_delete" on storage.objects;
create policy "candidate_documents_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.is_company_admin()
  );
