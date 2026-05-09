-- Split sourcing and application flows at the mission-candidate relation level.

alter table if exists public.candidate_missions
  add column if not exists source_type text not null default 'sourcing';

alter table if exists public.candidate_missions
  add column if not exists opportunity_score numeric(5,2)
  check (opportunity_score is null or opportunity_score between 0 and 100);

alter table if exists public.candidate_missions
  drop constraint if exists candidate_missions_source_type_check;

alter table if exists public.candidate_missions
  add constraint candidate_missions_source_type_check
  check (source_type in ('sourcing', 'application'));

update public.candidate_missions cm
set source_type = 'application'
where exists (
  select 1
  from public.pipeline_sessions ps
  where ps.company_id = cm.company_id
    and ps.candidate_id = cm.candidate_id
    and ps.mission_id = cm.mission_id
);

update public.candidate_missions
set source_type = 'sourcing'
where source_type is null;

create index if not exists candidate_missions_flow_idx
  on public.candidate_missions(company_id, mission_id, source_type, status);

create index if not exists candidate_missions_opportunity_idx
  on public.candidate_missions(company_id, mission_id, opportunity_score desc)
  where opportunity_score is not null;
