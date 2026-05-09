/**
 * Backend scoring engine.
 *
 * LLM produces 0-5 criteria grades. This module computes final 0-100 scores.
 * The LLM is never the owner of the final score.
 *
 * Scale:
 *   0 = no evidence
 *   1 = very weak
 *   2 = weak
 *   3 = acceptable
 *   4 = strong
 *   5 = excellent
 */

type CriteriaScores = Record<string, number>;

function clamp05(value: unknown): number {
  const n = typeof value === "number" ? value : 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function weightedScore(scores: CriteriaScores, weights: Record<string, number>): number {
  let weightedSum = 0;
  let maxPossible = 0;

  for (const [key, weight] of Object.entries(weights)) {
    weightedSum += clamp05(scores[key]) * weight;
    maxPossible += 5 * weight;
  }

  if (maxPossible === 0) return 0;
  return Math.round((weightedSum / maxPossible) * 100);
}

/* ------------------------------------------------------------------ */
/*  Sourcing                                                           */
/* ------------------------------------------------------------------ */

const SOURCING_FIT_WEIGHTS: Record<string, number> = {
  role_alignment: 30,
  seniority_match: 20,
  industry_relevance: 20,
  location_fit: 15,
  career_trajectory: 15,
};

const SOURCING_OPPORTUNITY_WEIGHTS: Record<string, number> = {
  timing_signals: 50,
  career_trajectory: 30,
};

export function computeSourcingFitScore(
  criteria: CriteriaScores,
  bonuses?: { linkedinVerified?: boolean; companyResearch?: boolean },
): number {
  const base = weightedScore(criteria, SOURCING_FIT_WEIGHTS);
  const linkedin = bonuses?.linkedinVerified ? 3 : 0;
  const research = bonuses?.companyResearch ? 2 : 0;
  return Math.min(100, base + linkedin + research);
}

export function computeSourcingOpportunityScore(
  criteria: CriteriaScores,
  bonuses?: { linkedinVerified?: boolean; companyResearch?: boolean },
): number {
  const base = weightedScore(criteria, SOURCING_OPPORTUNITY_WEIGHTS);
  const linkedin = bonuses?.linkedinVerified ? 5 : 0;
  const research = bonuses?.companyResearch ? 5 : 0;
  return Math.min(100, base + linkedin + research);
}

/* ------------------------------------------------------------------ */
/*  Application / Qualification                                        */
/* ------------------------------------------------------------------ */

const APPLICATION_FIT_WEIGHTS: Record<string, number> = {
  role_fit: 30,
  experience_relevance: 30,
  skill_match: 25,
  reasoning_quality: 15,
};

const APPLICATION_TEAM_FIT_WEIGHTS: Record<string, number> = {
  team_compatibility: 60,
  communication: 40,
};

const APPLICATION_PIPELINE_WEIGHTS: Record<string, number> = {
  reasoning_quality: 35,
  skill_match: 25,
  communication: 20,
  role_fit: 20,
};

const COHERENCE_BASE: Record<string, number> = {
  strong: 95,
  coherent: 90,
  weak: 60,
  pending: 75,
  none: 50,
};

export function computeApplicationFitScore(criteria: CriteriaScores): number {
  return weightedScore(criteria, APPLICATION_FIT_WEIGHTS);
}

export function computeApplicationTrustScore(
  coherenceStatus: string,
  inconsistencyCount: number,
): number {
  const base = COHERENCE_BASE[coherenceStatus] ?? COHERENCE_BASE.pending;
  const penalty = Math.min(30, inconsistencyCount * 8);
  return Math.max(0, Math.min(100, base - penalty));
}

export function computeApplicationTeamFitScore(criteria: CriteriaScores): number {
  return weightedScore(criteria, APPLICATION_TEAM_FIT_WEIGHTS);
}

export function computeApplicationPipelineScore(criteria: CriteriaScores): number {
  return weightedScore(criteria, APPLICATION_PIPELINE_WEIGHTS);
}

/* ------------------------------------------------------------------ */
/*  Recommendation derivation                                          */
/* ------------------------------------------------------------------ */

export function deriveSourcingRecommendation(fitScore: number, opportunityScore: number): string {
  if (fitScore >= 80 && opportunityScore >= 75) return "strong_match";
  if (fitScore < 30) return "do_not_contact";
  return "manual_review";
}

export function deriveApplicationRecommendation(fitScore: number, trustScore: number): string {
  if (fitScore >= 75 && trustScore >= 75) return "advance";
  if (fitScore < 45 || trustScore < 50) return "reject";
  return "hold";
}

export function scoreLevel(score: number): string {
  if (score >= 85) return "excellent";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
}
