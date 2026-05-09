-- Analysis cache: prevents redundant OpenAI calls when inputs haven't changed.
-- Hash includes mission data, profile data, linkedin, company research,
-- prompt version, scoring version, and model.

CREATE TABLE IF NOT EXISTS analysis_cache (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  input_hash      text        NOT NULL,
  analysis_type   text        NOT NULL,
  result          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  prompt_version  text        NOT NULL,
  scoring_version text        NOT NULL,
  model           text        NOT NULL,
  temperature     numeric     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE(company_id, input_hash, analysis_type)
);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_lookup
  ON analysis_cache (company_id, input_hash, analysis_type);

-- RLS
ALTER TABLE analysis_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analysis_cache_company_access" ON analysis_cache
  FOR ALL
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));
