-- Add metadata column to companies table
alter table public.companies add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Update comments for clarity
comment on column public.companies.metadata is 'Miscellaneous company-wide metadata (e.g. LinkedIn session info)';
