import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { completeHrJson, HR_CORE_MODEL } from "./openai";
import {
  SOURCING_ANALYSIS_SYSTEM,
  buildSourcingAnalysisUserPrompt,
  SOURCING_ANALYSIS_SCHEMA_NAME,
  SourcingAnalysisJsonSchema,
  PROMPT_VERSIONS,
  SCORING_VERSIONS,
} from "./prompts";
import { computeSourcingFitScore, computeSourcingOpportunityScore, scoreLevel } from "./scoring";
import { computeAnalysisHash, findCachedAnalysis, storeCachedAnalysis } from "./analysis-cache";
import { researchCompany, type CompanyResearchOutput } from "./research/company-research";
import { asObject, clampScore, pickNumber, pickString, truncateText } from "./utils";

type CandidateRow = {
  id: string;
  company_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  location: string | null;
  current_title: string | null;
  current_company_name: string | null;
  raw_profile: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

type CandidateApplicationRow = {
  id: string;
  company_id: string;
  candidate_id: string;
  mission_id: string;
  metadata: Record<string, unknown>;
};

function arraysFrom(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function fullName(candidate: CandidateRow) {
  return [candidate.first_name, candidate.last_name].filter(Boolean).join(" ").trim() || pickString(candidate.email) || "Unnamed profile";
}

function latestVerificationFields(value: unknown) {
  const row = asObject(value);
  return {
    profileName: pickString(row.profile_name, asObject(row.verification_data).linkedin_name, asObject(row.verification_data).name),
    headline: pickString(row.headline, asObject(row.verification_data).headline),
    currentCompany: pickString(row.current_company, asObject(row.verification_data).current_company),
    location: pickString(row.location, asObject(row.verification_data).location),
    confidenceScore: pickNumber(row.confidence_score),
    activity: {
      recentPosts: arraysFrom(asObject(row.verification_data).recent_posts || asObject(row.verification_data).activity),
      topics: stringArray(asObject(row.verification_data).activity_topics),
      lastActive: pickString(asObject(row.verification_data).last_active_at),
    },
    data: asObject(row.verification_data),
  };
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(v => String(v)).filter(Boolean);
}

type CompanySourceRelevance = "matched" | "uncertain" | "rejected";

function companySourceRelevance(value: unknown): CompanySourceRelevance {
  const normalized = pickString(value)?.toLowerCase();
  if (normalized === "matched" || normalized === "uncertain" || normalized === "rejected") return normalized;
  return "uncertain";
}

function companySourceFromSignal(signal: Record<string, unknown>) {
  return {
    label: pickString(signal.label),
    title: pickString(signal.source_title) ?? "Web result",
    url: pickString(signal.source_url) ?? "",
    reason: pickString(signal.reason),
    source_relevance: companySourceRelevance(signal.source_relevance),
  };
}

function companySourceFromExcluded(source: Record<string, unknown>) {
  return {
    label: pickString(source.label),
    title: pickString(source.title, source.source_title) ?? "Web result",
    url: pickString(source.url, source.source_url) ?? "",
    reason: pickString(source.reason),
    source_relevance: companySourceRelevance(source.source_relevance ?? "rejected"),
  };
}

function uniqueCompanySources(sources: ReturnType<typeof companySourceFromSignal>[]) {
  const seen = new Set<string>();
  const result: ReturnType<typeof companySourceFromSignal>[] = [];

  for (const source of sources) {
    const key = `${source.url || source.title}|${source.source_relevance}`.toLowerCase();
    if ((!source.url && !source.title) || seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }

  return result;
}

function fallbackSourcingAnalysis(input: {
  mission: Record<string, unknown>;
  candidate: CandidateRow;
  linkedin: ReturnType<typeof latestVerificationFields> | null;
  companyResearch?: CompanyResearchOutput | null;
}) {
  const missionText = [
    pickString(input.mission.title),
    pickString(input.mission.description),
    pickString(input.mission.requirements),
    JSON.stringify(asObject(input.mission.metadata)),
  ].filter(Boolean).join(" ").toLowerCase();
  const candidateText = [
    fullName(input.candidate),
    input.candidate.current_title,
    input.candidate.current_company_name,
    input.linkedin?.headline,
    JSON.stringify(input.linkedin?.activity ?? {}),
    JSON.stringify(input.candidate.raw_profile),
    JSON.stringify(input.linkedin?.data ?? {}),
    input.companyResearch?.summary,
    input.companyResearch?.recent_signals.join(" "),
  ].filter(Boolean).join(" ");
  const normalizedCandidateText = candidateText.toLowerCase();
  const missionTerms = missionText
    .split(/[^a-z0-9+#.]+/i)
    .filter((term) => term.length > 3)
    .slice(0, 150);
  const matchedTerms = [...new Set(missionTerms.filter((term) => normalizedCandidateText.includes(term)))].slice(0, 12);
  const hasLinkedIn = Boolean(input.linkedin || input.candidate.linkedin_url);
  const hasCurrentRole = Boolean(input.candidate.current_title);
  const hasCompanyResearch = Boolean(input.companyResearch?.summary || input.companyResearch?.source_urls.length);
  const fitScore = clampScore(58 + matchedTerms.length * 4 + (hasCurrentRole ? 8 : 0) + (hasLinkedIn ? 6 : 0), 62);
  const opportunityScore = clampScore(52 + (hasLinkedIn ? 12 : 0) + (hasCompanyResearch ? 8 : 0) + (input.linkedin?.confidenceScore ?? 0) / 10 + matchedTerms.length * 2, 60);

  return {
    fit_score: fitScore,
    opportunity_score: opportunityScore,
    recommendation: fitScore >= 80 && opportunityScore >= 75 ? "Contact first" : fitScore >= 65 ? "Review" : "Low fit",
    why_this_profile: matchedTerms.length
      ? `Profile matches mission language around ${matchedTerms.slice(0, 4).join(", ")}.`
      : "Profile has enough imported context for a first sourcing review, but needs richer LinkedIn signals.",
    why_now: hasCompanyResearch
      ? `Company research is available for ${input.companyResearch?.company_name}, so timing can be assessed with current market context.`
      : hasLinkedIn
      ? "LinkedIn context is available, so this profile can be prioritized for outreach timing review."
      : "LinkedIn verification is still needed before making this a priority outreach.",
    suggested_angle: input.candidate.current_title
      ? `Open with the relevance of their ${input.candidate.current_title} experience to this mission.`
      : "Open with the mission context and ask whether the timing is relevant.",
    signals: [
      {
        type: matchedTerms.length ? "positive" : "neutral",
        category: "mission_fit",
        label: matchedTerms.length ? "Mission language overlap" : "Limited structured match",
        description: matchedTerms.length
          ? `Matched terms: ${matchedTerms.join(", ")}.`
          : "Imported profile has limited structured data for scoring.",
        evidence: matchedTerms.join(", "),
        weight: matchedTerms.length * 4,
      },
      {
        type: hasLinkedIn ? "positive" : "negative",
        category: "linkedin",
        label: hasLinkedIn ? "LinkedIn signal available" : "LinkedIn verification missing",
        description: hasLinkedIn ? "LinkedIn data can support sourcing prioritization." : "Sourcing confidence is lower without LinkedIn context.",
        evidence: input.candidate.linkedin_url ?? "",
        weight: hasLinkedIn ? 10 : -10,
      },
    ],
    risks: hasLinkedIn ? ["No major sourcing risk detected from available data."] : ["LinkedIn profile must be verified before outreach."],
  };
}

async function generateSourcingAnalysis(input: {
  companyId: string;
  mission: Record<string, unknown>;
  candidate: CandidateRow;
  candidateMission: CandidateApplicationRow;
  linkedin: ReturnType<typeof latestVerificationFields> | null;
  companyResearch: CompanyResearchOutput | null;
  companyResearchError?: string | null;
}) {
  const model = HR_CORE_MODEL;

  // --- Rule 5: cache check ---
  const inputHash = computeAnalysisHash({
    missionData: input.mission,
    profileData: input.candidate,
    linkedinData: input.linkedin,
    companyResearch: input.companyResearch,
    promptVersion: PROMPT_VERSIONS.sourcing_analysis,
    scoringVersion: SCORING_VERSIONS.fit_score,
    model,
  });

  const cached = await findCachedAnalysis({
    companyId: input.companyId,
    inputHash,
    analysisType: "sourcing",
  });
  if (cached) {
    return { model, analysis: asObject(cached.result), inputHash, fromCache: true };
  }

  // --- Rule 2: strict structured outputs ---
  const ai = await completeHrJson({
    companyId: input.companyId,
    system: SOURCING_ANALYSIS_SYSTEM,
    user: buildSourcingAnalysisUserPrompt({
      mission: input.mission,
      candidateMission: input.candidateMission,
      importedProfile: input.candidate,
      linkedinVerification: input.linkedin,
      companyResearch: input.companyResearch,
      companyResearchError: input.companyResearchError,
    }),
    schema: SourcingAnalysisJsonSchema,
    schemaName: SOURCING_ANALYSIS_SCHEMA_NAME,
  });

  const fallback = fallbackSourcingAnalysis(input);
  const analysis = { ...fallback, ...asObject(ai?.data) };

  // --- Rule 5: store in cache ---
  await storeCachedAnalysis({
    companyId: input.companyId,
    inputHash,
    analysisType: "sourcing",
    result: analysis,
    promptVersion: PROMPT_VERSIONS.sourcing_analysis,
    scoringVersion: SCORING_VERSIONS.fit_score,
    model: ai?.model ?? model,
  });

  return { model: ai?.model ?? "heuristic", analysis, inputHash, fromCache: false };
}

function normalizeSourcingRecommendation(value: unknown, fitScore: number, opportunityScore: number) {
  const normalized = pickString(value)?.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (normalized === "strong_match" || normalized === "contact_first" || normalized === "strong") return "strong_match";
  if (normalized === "manual_review" || normalized === "review" || normalized === "review_needed" || normalized === "review_recommended") return "manual_review";
  if (normalized === "do_not_contact" || normalized === "reject" || normalized === "rejected" || normalized === "low_fit" || normalized === "weak_match") return "do_not_contact";
  if (fitScore >= 80 && opportunityScore >= 75) return "strong_match";
  if (fitScore < 30) return "do_not_contact";
  return "manual_review";
}

async function safeResearchCompany(input: {
  companyId: string;
  mission: Record<string, unknown>;
  candidate: CandidateRow;
  linkedin: ReturnType<typeof latestVerificationFields> | null;
}) {
  const companyName = pickString(input.candidate.current_company_name, input.linkedin?.currentCompany);
  if (!companyName) return { research: null, error: "Current company is missing" };

  try {
    const missionContext = [
      pickString(input.mission.title),
      pickString(input.mission.description),
      pickString(input.mission.requirements),
      JSON.stringify(asObject(input.mission.metadata)),
    ].filter(Boolean).join("\n");

    const research = await researchCompany({
      companyName,
      companyId: input.companyId,
      currentRole: pickString(input.candidate.current_title, input.linkedin?.headline) ?? undefined,
      location: pickString(input.candidate.location, input.linkedin?.location) ?? undefined,
      missionContext: truncateText(missionContext, 1200),
    });

    return { research, error: null };
  } catch (caught) {
    return {
      research: null,
      error: caught instanceof Error ? caught.message : "Company research failed",
    };
  }
}

export async function analyzeSourcingProfileForMission(input: {
  companyId: string;
  candidateId: string;
  applicationId?: string | null;
  scoredBy?: string | null;
}) {
  const supabase = createSupabaseServiceClient();

  const { data: candidateData, error: candidateError } = await supabase
    .from("candidates")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("id", input.candidateId)
    .maybeSingle();

  if (candidateError) throw new Error(candidateError.message || "Unable to load sourcing profile");
  if (!candidateData) throw new Error("Sourcing profile not found");

  let candidateMissionQuery = supabase
    .from("candidate_missions")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("candidate_id", input.candidateId)
    .eq("source_type", "sourcing");

  if (input.applicationId) {
    candidateMissionQuery = candidateMissionQuery.eq("mission_id", input.applicationId);
  }

  const { data: candidateMissionData, error: candidateMissionError } = await candidateMissionQuery
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (candidateMissionError) throw new Error(candidateMissionError.message || "Unable to load sourcing relation");
  if (!candidateMissionData) throw new Error("Profile is not attached to this mission as sourcing");

  const candidate = candidateData as CandidateRow;
  const candidateMission = candidateMissionData as CandidateApplicationRow;

  const [{ data: missionData }, { data: verificationData }] = await Promise.all([
    supabase
      .from("missions")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("id", candidateMission.mission_id)
      .maybeSingle(),
    supabase
      .from("linkedin_verifications")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("candidate_id", input.candidateId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!missionData) throw new Error("Mission not found");

  const linkedin = verificationData ? latestVerificationFields(verificationData) : null;
  const companyResearch = await safeResearchCompany({
    companyId: input.companyId,
    mission: asObject(missionData),
    candidate,
    linkedin,
  });
  const { model, analysis, inputHash } = await generateSourcingAnalysis({
    companyId: input.companyId,
    mission: asObject(missionData),
    candidate,
    candidateMission,
    linkedin,
    companyResearch: companyResearch.research,
    companyResearchError: companyResearch.error ? "Company research unavailable" : null,
  });

  // --- Rule 3: scores computed by backend or provided by AI ---
  const analysisObj = asObject(analysis);
  const criteriaScores = asObject(analysisObj.criteria_scores) as Record<string, number>;
  
  // Filter company signals based on relevance
  const analysisCompanySignals = arraysFrom(analysisObj.company_signals);
  const researchCompanySignals = companyResearch.research?.recent_signals || [];
  const rawCompanySignals = analysisCompanySignals.length > 0
    ? [...analysisCompanySignals, ...researchCompanySignals]
    : researchCompanySignals;

  const reviewedCompanySignals = rawCompanySignals.map(asObject);
  const matchedCompanySignals = reviewedCompanySignals
    .filter(s => companySourceRelevance(s.source_relevance) === "matched");
  const excludedCompanySources = arraysFrom(companyResearch.research?.excluded_sources).map(asObject);
  const companySourcesChecked = uniqueCompanySources([
    ...reviewedCompanySignals.map(companySourceFromSignal),
    ...excludedCompanySources.map(companySourceFromExcluded),
  ]);

  const hasUnconfirmedCompanySources = companySourcesChecked.some(s => s.source_relevance !== "matched");
  const hasMatchedSignals = matchedCompanySignals.length > 0;

  const bonuses = {
    linkedinVerified: Boolean(linkedin),
    companyResearch: hasMatchedSignals, // Only matched signals count as a bonus
  };

  let fitScore = pickNumber(analysisObj.fit_score) ?? computeSourcingFitScore(criteriaScores, bonuses);
  let opportunityScore = pickNumber(analysisObj.opportunity_score) ?? computeSourcingOpportunityScore(criteriaScores, bonuses);

  // Uncertain or rejected company sources must not increase opportunity score.
  if (companyResearch.research && !hasMatchedSignals) {
    const opportunityWithoutCompanyResearch = computeSourcingOpportunityScore(criteriaScores, {
      linkedinVerified: Boolean(linkedin),
      companyResearch: false,
    });
    opportunityScore = Math.min(opportunityScore, opportunityWithoutCompanyResearch);
  }

  // Detect hard exclusions
  const risks = arraysFrom(analysisObj.risks).map(asObject).slice(0, 8);
  const facts = arraysFrom(analysisObj.facts).map(asObject).slice(0, 12);
  const inferences = arraysFrom(analysisObj.inferences).map(asObject).slice(0, 12);
  const hypotheses = arraysFrom(analysisObj.hypotheses).map(asObject).slice(0, 8);
  const insufficientEvidence = arraysFrom(analysisObj.insufficient_evidence).map(String).filter(Boolean);
  
  const hardExclusionDetected = 
    risks.some(r => String(r.label).toLowerCase().includes("hard")) ||
    facts.some(f => String(f.type).toLowerCase() === "mismatch") ||
    inferences.some(i => String(i.type).toLowerCase() === "mismatch");

  // --- Rules for low fit and hard exclusions ---
  if (hardExclusionDetected) {
    fitScore = Math.min(fitScore ?? 100, 25);
    opportunityScore = Math.min(opportunityScore ?? 100, 15);
  } else if ((fitScore ?? 0) < 30) {
    opportunityScore = Math.min(opportunityScore ?? 100, 20);
  }

  const recommendation = normalizeSourcingRecommendation(analysisObj.recommendation, fitScore ?? 0, opportunityScore ?? 0);

  // --- Consistency Rules (Post-processing AI response) ---
  let whyThisProfile: string | null = pickString(analysisObj.why_this_profile) || recommendation;
  let whyNow: string | null = pickString(analysisObj.why_now);
  let suggestedAngle: string | null = pickString(analysisObj.suggested_angle);

  if (recommendation === "do_not_contact") {
    whyThisProfile = null;
    whyNow = null;
    suggestedAngle = null;
  } else {
    // Rule: if fit_score >= 60, why_now cannot say it doesn't fit
    if ((fitScore ?? 0) >= 60) {
      if (whyNow?.toLowerCase().includes("does not fit the mission") || whyNow?.toLowerCase().includes("not relevant")) {
        whyNow = (fitScore ?? 0) >= 75 
          ? "Timing not confirmed but profile fit is strong." 
          : "The profile is relevant enough for manual review despite unconfirmed timing.";
      }
    }

    // Default values if AI didn't provide them
    whyNow = whyNow || ((fitScore ?? 0) >= 75 ? "Timing not confirmed but profile fit is strong." : "Timing should be reviewed by the recruiter.");
    suggestedAngle = suggestedAngle || "Use the mission context as the opening angle.";
    whyThisProfile = whyThisProfile || recommendation || "Profile analysis pending manual review.";

    if (companyResearch.research && !hasMatchedSignals && whyNow) {
      const noMatchedCompanySignal = "Company research did not return a reliable matched signal for the current employer.";
      const mentionsCompanyTiming = /\b(company|employer|funding|layoff|hiring|growth|expansion|expanding|restructuring|acquisition|market)\b/i.test(whyNow);
      const alreadyMentionsNoMatch = /reliable matched signal|company research did not return/i.test(whyNow);

      if (mentionsCompanyTiming && !alreadyMentionsNoMatch) {
        const tenureSentence = whyNow.match(/[^.]*\b(tenure|current role|months|years)\b[^.]*\.?/i)?.[0]?.trim();
        whyNow = tenureSentence
          ? `${tenureSentence} ${noMatchedCompanySignal}`
          : `Timing is not confirmed. ${noMatchedCompanySignal}`;
      } else if (!alreadyMentionsNoMatch) {
        whyNow = `${whyNow} ${noMatchedCompanySignal}`;
      }
    }
  }

  // --- Rule 7: structured signals from facts/inferences/hypotheses ---

  // Build signal rows from facts + inferences
  type SignalItem = Record<string, unknown> & { evidence_level: string };
  const signalItems: SignalItem[] = [
    ...facts.map((f) => ({ ...f, evidence_level: "fact" })),
    ...inferences.map((f) => ({ ...f, evidence_level: "inference" })),
    ...hypotheses.map((f) => ({ ...f, evidence_level: "hypothesis" })),
  ];

  await supabase
    .from("candidate_signals")
    .delete()
    .eq("company_id", input.companyId)
    .eq("candidate_id", input.candidateId)
    .eq("mission_id", candidateMission.mission_id)
    .eq("source", "ai");

  // --- Rule 6: versioning metadata ---
  const versionMeta = {
    prompt_version: PROMPT_VERSIONS.sourcing_analysis,
    scoring_version: SCORING_VERSIONS.fit_score,
    model,
    temperature: 0,
    input_hash: inputHash,
  };

  const { data: insertedScores, error: scoreError } = await supabase
    .from("candidate_scores")
    .insert([
      {
        company_id: input.companyId,
        candidate_id: input.candidateId,
        mission_id: candidateMission.mission_id,
        scored_by: input.scoredBy ?? null,
        score_type: "fit",
        score: fitScore ?? 0,
        level: scoreLevel(fitScore ?? 0),
        criteria: { source: "sourcing_linkedin_mission", criteria_scores: criteriaScores, ...versionMeta },
        explanation: whyThisProfile || "Profile analysis pending manual review.",
        model_name: model || HR_CORE_MODEL,
      },
      {
        company_id: input.companyId,
        candidate_id: input.candidateId,
        mission_id: candidateMission.mission_id,
        scored_by: input.scoredBy ?? null,
        score_type: "opportunity",
        score: opportunityScore ?? 0,
        level: scoreLevel(opportunityScore ?? 0),
        criteria: { source: "sourcing_company_research", ...versionMeta },
        explanation: whyNow || "Timing should be reviewed by the recruiter.",
        model_name: model || HR_CORE_MODEL,
      }
    ])
    .select("*");

  if (scoreError) throw new Error(scoreError.message || "Unable to save sourcing scores");

  const signalRows = signalItems
    .filter((s) => pickString(s.label))
    .map((signal) => ({
      company_id: input.companyId,
      candidate_id: input.candidateId,
      mission_id: candidateMission.mission_id,
      score_id: Array.isArray(insertedScores) ? insertedScores[0]?.id : null,
      signal_type: signal.type === "mismatch" ? "negative" : signal.evidence_level === "fact" ? "positive" : "neutral",
      source: "ai",
      category: pickString(signal.category) ?? "sourcing",
      label: pickString(signal.label) || "Signal",
      description: pickString(signal.evidence) ?? null,
      evidence: pickString(signal.evidence) ?? null,
      weight: signal.type === "mismatch" ? -20 : 0,
      metadata: { ...versionMeta, evidence_level: signal.evidence_level, flow: "sourcing" },
    }));

  if (signalRows.length > 0) {
    const { error: signalError } = await supabase.from("candidate_signals").insert(signalRows);
    if (signalError) throw new Error(signalError.message || "Unable to save sourcing signals");
  }

  // --- Rule 8: Save company research snapshot ---
  if (companyResearch.research) {
    await supabase.from("company_research_snapshots").insert({
      company_id: input.companyId,
      company_name: companyResearch.research.company_name,
      query: truncateText(pickString(candidate.current_company_name, linkedin?.currentCompany) || "", 500),
      summary: companyResearch.research.summary,
      recent_signals: companyResearch.research.recent_signals,
      source_urls: companyResearch.research.source_urls,
      raw_results: { excluded: companyResearch.research.excluded_sources }, 
    });
  }

  const companyContextSummary = hasMatchedSignals
    ? companyResearch.research?.summary || "Matched company signal found."
    : hasUnconfirmedCompanySources
      ? "Unconfirmed company context. Sources found may refer to a different company, so they were not used to increase the recommendation."
      : "No reliable recent company signal found.";

  const nextMetadata = {
    ...asObject(candidateMission.metadata),
    why_this_profile: whyThisProfile,
    why_now: whyNow,
    suggested_angle: suggestedAngle,
    facts,
    inferences,
    hypotheses,
    insufficient_evidence: insufficientEvidence,
    risks,
    criteria_scores: criteriaScores,
    fit_score: fitScore,
    opportunity_score: opportunityScore,
    recommendation,
    company_context_summary: companyContextSummary,
    recent_company_signals: matchedCompanySignals.map(s => {
          const obj = asObject(s);
          return {
            label: pickString(obj.label),
            description: pickString(obj.description),
            impact_on_opportunity: pickString(obj.impact_on_opportunity) || pickString(obj.impact) || "neutral",
            source_url: pickString(obj.source_url),
            source_title: pickString(obj.source_title),
            source_relevance: pickString(obj.source_relevance) || "matched",
            reason: pickString(obj.reason),
          };
        }),
    company_sources_checked: companySourcesChecked,
    source_urls: companyResearch.research?.source_urls || [],
    company_research_error: companyResearch.error,
    ...versionMeta,
  };

  const { data: updatedCandidateMission, error: updateError } = await supabase
    .from("candidate_missions")
    .update({
      status: (fitScore ?? 0) >= 70 && (opportunityScore ?? 0) >= 65 ? "qualified" : "screening",
      fit_score: fitScore,
      opportunity_score: opportunityScore,
      recommendation,
      metadata: nextMetadata,
    })
    .eq("id", candidateMission.id)
    .select("*")
    .single();

  if (updateError) throw new Error(updateError.message || "Unable to update sourcing relation");

  return {
    candidateMission: updatedCandidateMission,
    fitScore,
    opportunityScore,
    recommendation,
    whyThisProfile,
    whyNow,
    suggestedAngle,
    risks,
    signalsCount: signalRows.length,
    model,
  };
}
