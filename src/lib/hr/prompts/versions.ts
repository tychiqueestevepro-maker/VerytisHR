/** Prompt versions — increment when prompt content changes */
export const PROMPT_VERSIONS = {
  system: "system_v1.0",
  sourcing_analysis: "sourcing_v1.1",
  cv_parsing: "cv_v1.0",
  application_analysis: "application_v1.0",
  pipeline_generation: "pipeline_v1.1",
} as const;

/** Scoring versions — increment when scoring formula changes */
export const SCORING_VERSIONS = {
  fit_score: "fit_v1.0",
  opportunity_score: "opportunity_v1.0",
  trust_score: "trust_v1.0",
  team_fit_score: "team_fit_v1.0",
  pipeline_score: "pipeline_v1.0",
} as const;
