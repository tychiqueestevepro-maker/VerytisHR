-- Add resumable, one-question-at-a-time assessment sessions and integrity events.

alter table public.pipeline_sessions
  drop constraint if exists pipeline_sessions_status_check;

alter table public.pipeline_sessions
  add constraint pipeline_sessions_status_check
  check (status in (
    'not_started',
    'in_progress',
    'paused',
    'completed',
    'incomplete',
    'flagged',
    'opened',
    'submitted',
    'analyzed',
    'failed',
    'expired',
    'cancelled'
  ));

alter table public.pipeline_sessions
  alter column status set default 'not_started',
  add column if not exists candidate_linkedin_url text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists current_question_index integer not null default 0 check (current_question_index >= 0),
  add column if not exists total_questions integer not null default 0 check (total_questions >= 0),
  add column if not exists time_limit_minutes integer check (time_limit_minutes is null or time_limit_minutes >= 0),
  add column if not exists time_spent_seconds integer not null default 0 check (time_spent_seconds >= 0),
  add column if not exists is_flagged boolean not null default false,
  add column if not exists flag_reason text;

drop index if exists public.pipeline_sessions_one_open_per_candidate;
create unique index pipeline_sessions_one_open_per_candidate
  on public.pipeline_sessions(candidate_id, pipeline_id)
  where status in ('opened', 'not_started', 'in_progress', 'paused');

alter type public.response_status add value if not exists 'opened';
alter type public.response_status add value if not exists 'locked';
alter type public.response_status add value if not exists 'timed_out';

alter table public.candidate_pipeline_responses
  alter column submitted_at drop not null,
  add column if not exists started_at timestamptz,
  add column if not exists time_spent_seconds integer not null default 0 check (time_spent_seconds >= 0),
  add column if not exists is_locked boolean not null default false,
  add column if not exists copy_paste_attempts integer not null default 0 check (copy_paste_attempts >= 0),
  add column if not exists focus_lost_count integer not null default 0 check (focus_lost_count >= 0);

create table if not exists public.pipeline_session_events (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  pipeline_session_id uuid not null references public.pipeline_sessions(id) on delete cascade,
  question_id uuid references public.pipeline_questions(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pipeline_session_events_session_idx
  on public.pipeline_session_events(pipeline_session_id, created_at desc);

create index if not exists pipeline_session_events_company_idx
  on public.pipeline_session_events(company_id, created_at desc);

alter table public.pipeline_session_events enable row level security;

drop policy if exists "pipeline_session_events_select_company" on public.pipeline_session_events;
create policy "pipeline_session_events_select_company"
  on public.pipeline_session_events for select to authenticated
  using (company_id = public.current_company_id());

grant select on public.pipeline_session_events to authenticated;
grant all on public.pipeline_session_events to service_role;
