-- Create company_research_snapshots table
CREATE TABLE IF NOT EXISTS public.company_research_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    company_website TEXT,
    company_linkedin_url TEXT,
    query TEXT NOT NULL,
    summary TEXT,
    recent_signals JSONB DEFAULT '[]'::jsonb,
    source_urls JSONB DEFAULT '[]'::jsonb,
    raw_results JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_company_research_snapshots_company_id ON public.company_research_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_company_research_snapshots_company_name ON public.company_research_snapshots(company_name);

-- Add RLS
ALTER TABLE public.company_research_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for service role" ON public.company_research_snapshots
    USING (true)
    WITH CHECK (true);
