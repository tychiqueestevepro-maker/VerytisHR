import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { completeHrJson, HR_CORE_MODEL } from "./openai";
import {
  APPLICATION_ANALYSIS_SYSTEM,
  buildApplicationAnalysisUserPrompt,
  APPLICATION_ANALYSIS_SCHEMA_NAME,
  ApplicationAnalysisJsonSchema,
  PROMPT_VERSIONS,
  SCORING_VERSIONS,
} from "./prompts";
import { computeApplicationFitScore, computeApplicationTrustScore, computeApplicationTeamFitScore, deriveApplicationRecommendation, scoreLevel } from "./scoring";
import { computeAnalysisHash, findCachedAnalysis, storeCachedAnalysis } from "./analysis-cache";
import { asObject, clampScore, pickString, truncateText } from "./utils";

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
};

type ApplicationRow = {
  id: string;
  company_id: string;
  title: string;
  location: string | null;
  description: string | null;
  responsibilities: string | null;
  requirements: string | null;
  metadata: Record<string, unknown>;
};

type CandidateApplicationRow = {
  id: string;
  company_id: string;
  candidate_id: string;
  mission_id: string;
  metadata: Record<string, unknown>;
};

type AnalysisSignal = {
  type?: "positive" | "neutral" | "negative";
  category?: string;
  label?: string;
  description?: string;
  evidence?: string;
  weight?: number;
};

type AnalysisInconsistency = {
  severity?: "low" | "medium" | "high" | "critical";
  field_name?: string;
  document_value?: string | null;
  linkedin_value?: string | null;
  description?: string;
};

function fullName(candidate: CandidateRow) {
  return [candidate.first_name, candidate.last_name].filter(Boolean).join(" ").trim() || null;
}

function norm(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function arraysFrom(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown) {
  return arraysFrom(value).filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}

function latestVerificationFields(value: unknown) {
  const row = asObject(value);
  return {
    profileName: pickString(row.profile_name, asObject(row.verification_data).linkedin_name, asObject(row.verification_data).name),
    headline: pickString(row.headline, asObject(row.verification_data).headline),
    currentCompany: pickString(row.current_company, asObject(row.verification_data).current_company),
    location: pickString(row.location, asObject(row.verification_data).location),
    data: asObject(row.verification_data),
  };
}

function parsedResumeFields(value: unknown) {
  const row = asObject(value);
  const parsed = asObject(row.parsed_data);

  return {
    summary: pickString(parsed.summary),
    companies: stringArray(parsed.companies),
    jobTitles: stringArray(parsed.job_titles),
    skills: stringArray(parsed.skills),
    education: arraysFrom(parsed.education),
    experiences: arraysFrom(parsed.experiences),
    location: pickString(parsed.location),
    rawText: pickString(row.extracted_text),
  };
}

function heuristicInconsistencies(input: {
  candidate: CandidateRow;
  resume: ReturnType<typeof parsedResumeFields>;
  linkedin: ReturnType<typeof latestVerificationFields> | null;
}) {
  const issues: AnalysisInconsistency[] = [];
  if (!input.linkedin) return issues;

  const candidateName = fullName(input.candidate);
  if (candidateName && input.linkedin.profileName && norm(candidateName) !== norm(input.linkedin.profileName)) {
    issues.push({
      severity: "medium",
      field_name: "name",
      document_value: candidateName,
      linkedin_value: input.linkedin.profileName,
      description: "Candidate name differs between the candidate record and LinkedIn profile.",
    });
  }

  if (
    input.candidate.current_company_name &&
    input.linkedin.currentCompany &&
    !norm(input.linkedin.currentCompany).includes(norm(input.candidate.current_company_name)) &&
    !norm(input.candidate.current_company_name).includes(norm(input.linkedin.currentCompany))
  ) {
    issues.push({
      severity: "medium",
      field_name: "current_company",
      document_value: input.candidate.current_company_name,
      linkedin_value: input.linkedin.currentCompany,
      description: "Current company differs between candidate data and LinkedIn.",
    });
  }

  if (input.resume.location && input.linkedin.location && norm(input.resume.location) !== norm(input.linkedin.location)) {
    issues.push({
      severity: "low",
      field_name: "location",
      document_value: input.resume.location,
      linkedin_value: input.linkedin.location,
      description: "Location differs between resume extraction and LinkedIn.",
    });
  }

  return issues;
}

function fallbackAnalysis(input: {
  mission: ApplicationRow;
  candidate: CandidateRow;
  resume: ReturnType<typeof parsedResumeFields>;
  inconsistencies: AnalysisInconsistency[];
}) {
  const requirements = `${input.mission.requirements || ""} ${input.mission.description || ""}`.toLowerCase();
  const skills = input.resume.skills.map((skill) => skill.toLowerCase());
  const matchedSkills = skills.filter((skill) => skill.length > 2 && requirements.includes(skill)).slice(0, 8);
  const fitScore = clampScore(55 + matchedSkills.length * 5 + (input.candidate.current_title ? 8 : 0), 60);
  const trustPenalty = input.inconsistencies.reduce((total, issue) => {
    if (issue.severity === "critical") return total + 30;
    if (issue.severity === "high") return total + 20;
    if (issue.severity === "medium") return total + 10;
    return total + 4;
  }, 0);
  const trustScore = clampScore(92 - trustPenalty, 80);

  return {
    fit_score: fitScore,
    trust_score: trustScore,
    recommendation: fitScore >= 75 && trustScore >= 75 ? "Strong match" : fitScore >= 60 ? "Review recommended" : "Weak match",
    reason: matchedSkills.length
      ? `Matched skills: ${matchedSkills.join(", ")}.`
      : "Candidate analysis used extracted resume and LinkedIn fields with limited structured skill matches.",
    signals: [
      {
        type: matchedSkills.length ? "positive" : "neutral",
        category: "mission_fit",
        label: matchedSkills.length ? "Skills aligned with mission" : "Manual review needed",
        description: matchedSkills.length
          ? `Matched skills: ${matchedSkills.join(", ")}.`
          : "Structured data is not rich enough for a high-confidence automated fit score.",
        evidence: matchedSkills.join(", "),
        weight: matchedSkills.length * 5,
      },
      {
        type: input.inconsistencies.length ? "negative" : "positive",
        category: "trust",
        label: input.inconsistencies.length ? "Profile inconsistencies detected" : "No obvious profile inconsistencies",
        description: input.inconsistencies.length
          ? `${input.inconsistencies.length} consistency issue(s) detected.`
          : "No basic CV/LinkedIn mismatch detected.",
        evidence: "",
        weight: input.inconsistencies.length ? -10 : 10,
      },
    ],
    inconsistencies: input.inconsistencies,
  };
}

async function generateCandidateAnalysis(input: {
  companyId: string;
  mission: ApplicationRow;
  candidate: CandidateRow;
  candidateMission: CandidateApplicationRow;
  resume: ReturnType<typeof parsedResumeFields>;
  linkedin: ReturnType<typeof latestVerificationFields> | null;
  inconsistencies: AnalysisInconsistency[];
}) {
  const model = HR_CORE_MODEL;

  // --- Rule 5: cache check ---
  const inputHash = computeAnalysisHash({
    missionData: input.mission,
    profileData: input.candidate,
    linkedinData: input.linkedin,
    promptVersion: PROMPT_VERSIONS.application_analysis,
    scoringVersion: SCORING_VERSIONS.fit_score,
    model,
  });

  const cached = await findCachedAnalysis({
    companyId: input.companyId,
    inputHash,
    analysisType: "application",
  });
  if (cached) {
    return { model, analysis: asObject(cached.result), inputHash, fromCache: true };
  }

  // --- Rule 2: strict structured outputs ---
  const ai = await completeHrJson({
    companyId: input.companyId,
    system: APPLICATION_ANALYSIS_SYSTEM,
    user: buildApplicationAnalysisUserPrompt({
      mission: input.mission,
      candidate: input.candidate,
      parsedResume: input.resume,
      linkedinVerification: input.linkedin,
      inconsistencies: input.inconsistencies,
    }),
    schema: ApplicationAnalysisJsonSchema,
    schemaName: APPLICATION_ANALYSIS_SCHEMA_NAME,
  });

  if (!ai) {
    const fb = fallbackAnalysis({ mission: input.mission, candidate: input.candidate, resume: input.resume, inconsistencies: input.inconsistencies });
    return { model: "heuristic", analysis: fb, inputHash, fromCache: false };
  }

  const analysis = {
    ...fallbackAnalysis({ mission: input.mission, candidate: input.candidate, resume: input.resume, inconsistencies: input.inconsistencies }),
    ...ai.data,
  };

  // --- Rule 5: store in cache ---
  await storeCachedAnalysis({
    companyId: input.companyId,
    inputHash,
    analysisType: "application",
    result: analysis,
    promptVersion: PROMPT_VERSIONS.application_analysis,
    scoringVersion: SCORING_VERSIONS.fit_score,
    model: ai.model,
  });

  return { model: ai.model, analysis, inputHash, fromCache: false };
}

export async function analyzeCandidateForMission(input: {
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

  if (candidateError) throw new Error(candidateError.message || "Unable to load candidate");
  if (!candidateData) throw new Error("Candidate not found");

  let candidateMissionQuery = supabase
    .from("candidate_missions")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("candidate_id", input.candidateId)
    .eq("source_type", "application");

  if (input.applicationId) {
    candidateMissionQuery = candidateMissionQuery.eq("mission_id", input.applicationId);
  }

  const { data: candidateMissionData, error: candidateMissionError } = await candidateMissionQuery
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (candidateMissionError) throw new Error(candidateMissionError.message || "Unable to load candidate mission");
  if (!candidateMissionData) throw new Error("Candidate is not attached to this mission");

  const candidate = candidateData as CandidateRow;
  const candidateMission = candidateMissionData as CandidateApplicationRow;

  const [{ data: missionData }, { data: documentData }, { data: verificationData }] = await Promise.all([
    supabase
      .from("missions")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("id", candidateMission.mission_id)
      .maybeSingle(),
    supabase
      .from("candidate_documents")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("candidate_id", input.candidateId)
      .eq("document_type", "resume")
      .order("created_at", { ascending: false })
      .limit(1)
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

  const mission = missionData as ApplicationRow;
  const resume = parsedResumeFields(documentData);
  const linkedin = verificationData ? latestVerificationFields(verificationData) : null;
  const heuristicIssues = heuristicInconsistencies({ candidate, resume, linkedin });
  const { model, analysis, inputHash } = await generateCandidateAnalysis({
    companyId: input.companyId,
    mission,
    candidate,
    candidateMission,
    resume: {
      ...resume,
      rawText: resume.rawText ? truncateText(resume.rawText, 8000) : null,
    },
    linkedin,
    inconsistencies: heuristicIssues,
  });

  // --- Rule 3: scores computed by backend from 0-5 criteria ---
  const criteriaScores = asObject(asObject(analysis).criteria_scores) as Record<string, number>;
  const coherenceStatus = pickString(asObject(asObject(analysis).linkedin_cv_coherence).status) ?? "pending";
  const fitScore = computeApplicationFitScore(criteriaScores);
  const trustScore = computeApplicationTrustScore(coherenceStatus, heuristicIssues.length);
  const teamFitScore = computeApplicationTeamFitScore(criteriaScores);
  const recommendation = deriveApplicationRecommendation(fitScore, trustScore);
  const summary = pickString(asObject(analysis).summary) || recommendation;

  // --- Rule 7: structured signals from facts/inferences/hypotheses ---
  const facts = arraysFrom(asObject(analysis).facts).map(asObject).slice(0, 12);
  const inferences = arraysFrom(asObject(analysis).inferences).map(asObject).slice(0, 12);
  const hypotheses = arraysFrom(asObject(analysis).hypotheses).map(asObject).slice(0, 8);
  const insufficientEvidence = arraysFrom(asObject(analysis).insufficient_evidence).map(String).filter(Boolean);

  await supabase
    .from("candidate_signals")
    .delete()
    .eq("company_id", input.companyId)
    .eq("candidate_id", input.candidateId)
    .eq("mission_id", candidateMission.mission_id)
    .eq("source", "ai");

  // --- Rule 6: versioning metadata ---
  const versionMeta = {
    prompt_version: PROMPT_VERSIONS.application_analysis,
    scoring_version: SCORING_VERSIONS.fit_score,
    model,
    temperature: 0,
    input_hash: inputHash,
  };

  const scoreRows = [
    {
      company_id: input.companyId,
      candidate_id: input.candidateId,
      mission_id: candidateMission.mission_id,
      scored_by: input.scoredBy ?? null,
      score_type: "fit",
      score: fitScore,
      level: scoreLevel(fitScore),
      criteria: { source: "resume_linkedin_mission", criteria_scores: criteriaScores, ...versionMeta },
      explanation: summary,
      model_name: model || HR_CORE_MODEL,
    },
    {
      company_id: input.companyId,
      candidate_id: input.candidateId,
      mission_id: candidateMission.mission_id,
      scored_by: input.scoredBy ?? null,
      score_type: "trust",
      score: trustScore,
      level: scoreLevel(trustScore),
      criteria: { source: "cv_linkedin_consistency", coherence_status: coherenceStatus, ...versionMeta },
      explanation: summary,
      model_name: model || HR_CORE_MODEL,
    },
  ];

  const { data: insertedScores, error: scoreError } = await supabase
    .from("candidate_scores")
    .insert(scoreRows)
    .select("*");

  if (scoreError) throw new Error(scoreError.message || "Unable to save candidate scores");

  // Build signal rows from facts + inferences
  type SignalItem = Record<string, unknown> & { evidence_level: string };
  const signalItems: SignalItem[] = [
    ...facts.map((f) => ({ ...f, evidence_level: "fact" as const })),
    ...inferences.map((f) => ({ ...f, evidence_level: "inference" as const })),
    ...hypotheses.map((f) => ({ ...f, evidence_level: "hypothesis" as const })),
  ];

  const signals = signalItems
    .filter((s) => pickString(s.label))
    .slice(0, 12)
    .map((signal) => ({
      company_id: input.companyId,
      candidate_id: input.candidateId,
      mission_id: candidateMission.mission_id,
      score_id: Array.isArray(insertedScores) ? insertedScores[0]?.id ?? null : null,
      signal_type: signal.evidence_level === "fact" ? "positive" : "neutral",
      source: "ai",
      category: pickString(signal.category) ?? "application",
      label: pickString(signal.label) || "Signal",
      description: pickString(signal.evidence) ?? null,
      evidence: pickString(signal.evidence) ?? null,
      weight: 0,
      metadata: { ...versionMeta, evidence_level: signal.evidence_level },
    }));

  if (signals.length > 0) {
    const { error: signalError } = await supabase.from("candidate_signals").insert(signals);
    if (signalError) throw new Error(signalError.message || "Unable to save candidate signals");
  }

  const inconsistencies = arraysFrom(asObject(asObject(analysis).linkedin_cv_coherence).issues)
    .map(String)
    .filter(Boolean)
    .slice(0, 12)
    .map((issue) => ({
      company_id: input.companyId,
      candidate_id: input.candidateId,
      mission_id: candidateMission.mission_id,
      verification_id: verificationData ? asObject(verificationData).id : null,
      document_id: documentData ? asObject(documentData).id : null,
      severity: "medium" as const,
      field_name: "profile",
      document_value: null,
      linkedin_value: null,
      description: issue,
      status: "open",
      metadata: versionMeta,
    }));

  if (inconsistencies.length > 0) {
    const { error: inconsistencyError } = await supabase.from("candidate_inconsistencies").insert(inconsistencies);
    if (inconsistencyError) {
      throw new Error(inconsistencyError.message || "Unable to save candidate inconsistencies");
    }
  }

  const { data: updatedCandidateMission, error: updateError } = await supabase
    .from("candidate_missions")
    .update({
      status: fitScore >= 70 && trustScore >= 70 ? "qualified" : "screening",
      source_type: "application",
      fit_score: fitScore,
      trust_score: trustScore,
      recommendation,
      metadata: {
        ...asObject(candidateMission.metadata),
        criteria_scores: criteriaScores,
        team_fit_score: teamFitScore,
        coherence_status: coherenceStatus,
        facts,
        inferences,
        hypotheses,
        insufficient_evidence: insufficientEvidence,
        strengths: arraysFrom(asObject(analysis).strengths),
        risks: arraysFrom(asObject(analysis).risks),
        summary,
        ...versionMeta,
      },
    })
    .eq("id", candidateMission.id)
    .select("*")
    .single();

  if (updateError) throw new Error(updateError.message || "Unable to update candidate mission");

  return {
    candidateMission: updatedCandidateMission,
    fitScore,
    trustScore,
    teamFitScore,
    recommendation,
    reason: summary,
    model,
    signalsCount: signals.length,
    inconsistenciesCount: inconsistencies.length,
  };
}
