/**
 * JSON Schemas for OpenAI Structured Outputs (strict: true).
 *
 * Rules:
 * - All object properties must be listed in `required`
 * - `additionalProperties: false` on every object
 * - Nullable via anyOf: [{type:"string"},{type:"null"}]
 * - Criteria scored 0-5 integer only
 */

/* ------------------------------------------------------------------ */
/*  Shared fragments                                                   */
/* ------------------------------------------------------------------ */

const EVIDENCE_ITEM = {
  type: "object" as const,
  properties: {
    label: { type: "string" as const },
    evidence: { type: "string" as const },
    category: { type: "string" as const },
    type: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
  },
  required: ["label", "evidence", "category", "type"],
  additionalProperties: false,
};

const RISK_ITEM = {
  type: "object" as const,
  properties: {
    label: { type: "string" as const },
    description: { type: "string" as const },
    type: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
  },
  required: ["label", "description", "type"],
  additionalProperties: false,
};

const CRITERION_SCORE = { type: "integer" as const };

/* ------------------------------------------------------------------ */
/*  1. Sourcing Analysis                                               */
/* ------------------------------------------------------------------ */

export const SOURCING_ANALYSIS_SCHEMA_NAME = "sourcing_analysis";

export const SourcingAnalysisJsonSchema = {
  type: "object" as const,
  properties: {
    criteria_scores: {
      type: "object" as const,
      properties: {
        role_alignment: CRITERION_SCORE,
        seniority_match: CRITERION_SCORE,
        industry_relevance: CRITERION_SCORE,
        timing_signals: CRITERION_SCORE,
        location_fit: CRITERION_SCORE,
        career_trajectory: CRITERION_SCORE,
      },
      required: [
        "role_alignment",
        "seniority_match",
        "industry_relevance",
        "timing_signals",
        "location_fit",
        "career_trajectory",
      ],
      additionalProperties: false,
    },
    fit_score: { type: "integer" as const },
    opportunity_score: { type: "integer" as const },
    recommendation: { type: "string" as const },
    why_this_profile: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
    why_now: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
    suggested_angle: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
    facts: { type: "array" as const, items: EVIDENCE_ITEM },
    inferences: { type: "array" as const, items: EVIDENCE_ITEM },
    hypotheses: { type: "array" as const, items: EVIDENCE_ITEM },
    insufficient_evidence: { type: "array" as const, items: { type: "string" as const } },
    risks: { type: "array" as const, items: RISK_ITEM },
    company_signals: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          label: { type: "string" as const },
          description: { type: "string" as const },
          impact: { type: "string" as const },
          source_url: { type: "string" as const },
          source_title: { type: "string" as const },
          source_relevance: { type: "string" as const },
          reason: { type: "string" as const },
        },
        required: ["label", "description", "impact", "source_url", "source_title", "source_relevance", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "criteria_scores",
    "fit_score",
    "opportunity_score",
    "recommendation",
    "why_this_profile",
    "why_now",
    "suggested_angle",
    "facts",
    "inferences",
    "hypotheses",
    "insufficient_evidence",
    "risks",
    "company_signals",
  ],
  additionalProperties: false,
};

/* ------------------------------------------------------------------ */
/*  2. CV Parsing                                                      */
/* ------------------------------------------------------------------ */

export const CV_PARSING_SCHEMA_NAME = "cv_parsing";

export const CvParsingJsonSchema = {
  type: "object" as const,
  properties: {
    full_name: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
    current_title: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
    current_company: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
    location: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
    summary: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
    experiences: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const },
          company: { type: "string" as const },
          start_date: { type: "string" as const },
          end_date: { type: "string" as const },
          description: { type: "string" as const },
        },
        required: ["title", "company", "start_date", "end_date", "description"],
        additionalProperties: false,
      },
    },
    companies: { type: "array" as const, items: { type: "string" as const } },
    job_titles: { type: "array" as const, items: { type: "string" as const } },
    skills: { type: "array" as const, items: { type: "string" as const } },
    education: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          institution: { type: "string" as const },
          degree: { type: "string" as const },
          field: { type: "string" as const },
          year: { anyOf: [{ type: "string" as const }, { type: "null" as const }] },
        },
        required: ["institution", "degree", "field", "year"],
        additionalProperties: false,
      },
    },
    seniority_level: { type: "string" as const },
  },
  required: [
    "full_name", "current_title", "current_company", "location", "summary",
    "experiences", "companies", "job_titles", "skills", "education", "seniority_level",
  ],
  additionalProperties: false,
};

/* ------------------------------------------------------------------ */
/*  3. Application Analysis (qualification + pipeline session)         */
/* ------------------------------------------------------------------ */

export const APPLICATION_ANALYSIS_SCHEMA_NAME = "application_analysis";

export const ApplicationAnalysisJsonSchema = {
  type: "object" as const,
  properties: {
    criteria_scores: {
      type: "object" as const,
      properties: {
        role_fit: CRITERION_SCORE,
        experience_relevance: CRITERION_SCORE,
        skill_match: CRITERION_SCORE,
        reasoning_quality: CRITERION_SCORE,
        team_compatibility: CRITERION_SCORE,
        communication: CRITERION_SCORE,
      },
      required: [
        "role_fit", "experience_relevance", "skill_match",
        "reasoning_quality", "team_compatibility", "communication",
      ],
      additionalProperties: false,
    },
    linkedin_cv_coherence: {
      type: "object" as const,
      properties: {
        status: { type: "string" as const },
        summary: { type: "string" as const },
        issues: { type: "array" as const, items: { type: "string" as const } },
      },
      required: ["status", "summary", "issues"],
      additionalProperties: false,
    },
    facts: { type: "array" as const, items: EVIDENCE_ITEM },
    inferences: { type: "array" as const, items: EVIDENCE_ITEM },
    hypotheses: { type: "array" as const, items: EVIDENCE_ITEM },
    insufficient_evidence: { type: "array" as const, items: { type: "string" as const } },
    strengths: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          label: { type: "string" as const },
          evidence: { type: "string" as const },
        },
        required: ["label", "evidence"],
        additionalProperties: false,
      },
    },
    risks: { type: "array" as const, items: RISK_ITEM },
    recommendation: { type: "string" as const },
    summary: { type: "string" as const },
  },
  required: [
    "criteria_scores", "linkedin_cv_coherence",
    "facts", "inferences", "hypotheses", "insufficient_evidence",
    "strengths", "risks", "recommendation", "summary",
  ],
  additionalProperties: false,
};

/* ------------------------------------------------------------------ */
/*  4. Pipeline Generation                                             */
/* ------------------------------------------------------------------ */

export const PIPELINE_GENERATION_SCHEMA_NAME = "pipeline_generation";

export const PipelineGenerationJsonSchema = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const },
    description: { type: "string" as const },
    difficulty: { type: "string" as const },
    estimated_total_time_minutes: { type: "integer" as const },
    evaluation_criteria: { type: "array" as const, items: { type: "string" as const } },
    steps: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          description: { type: "string" as const },
          step_type: { type: "string" as const },
          questions: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                question_type: { type: "string" as const },
                label: { type: "string" as const },
                description: { type: "string" as const },
                placeholder: { type: "string" as const },
                context: { type: "string" as const },
                skill_tested: { type: "string" as const },
                difficulty: { type: "string" as const },
                options: { type: "array" as const, items: { type: "string" as const } },
                is_required: { type: "boolean" as const },
                scoring_weight: { type: "integer" as const },
                knockout: { type: "boolean" as const },
                evaluation_criteria: { type: "array" as const, items: { type: "string" as const } },
                expected_good_answer_signals: { type: "array" as const, items: { type: "string" as const } },
                red_flags: { type: "array" as const, items: { type: "string" as const } },
                estimated_time_minutes: { type: "integer" as const },
              },
              required: [
                "question_type", "label", "description", "placeholder", "context",
                "skill_tested", "difficulty", "options", "is_required", "scoring_weight",
                "knockout", "evaluation_criteria", "expected_good_answer_signals",
                "red_flags", "estimated_time_minutes",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "description", "step_type", "questions"],
        additionalProperties: false,
      },
    },
  },
  required: ["name", "description", "difficulty", "estimated_total_time_minutes", "evaluation_criteria", "steps"],
  additionalProperties: false,
};
