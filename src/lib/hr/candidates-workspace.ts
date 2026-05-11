import { cache } from "react";
import { getHrContext } from "@/lib/hr/auth";
import { asObject, formatDate, pickNumber, pickString, relativeTime } from "@/lib/hr/utils";

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function byKey(items: Row[], key: string) {
  const map = new Map<string, Row[]>();

  for (const item of items) {
    const id = pickString(item[key]);
    if (!id) continue;
    const current = map.get(id) ?? [];
    current.push(item);
    map.set(id, current);
  }

  return map;
}

function latest(items: Row[], fields: string[] = ["updated_at", "checked_at", "scored_at", "created_at"]) {
  return [...items].sort((a, b) => {
    const aDate = fields.map((field) => pickString(a[field])).find(Boolean) ?? "";
    const bDate = fields.map((field) => pickString(b[field])).find(Boolean) ?? "";
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  })[0] ?? null;
}

function roundScore(value: unknown) {
  const score = pickNumber(value);
  return score === null ? null : Math.round(score);
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function fullName(candidate: Row | null | undefined) {
  const first = pickString(candidate?.first_name);
  const last = pickString(candidate?.last_name);
  return [first, last].filter(Boolean).join(" ").trim() || pickString(candidate?.email) || "Unnamed candidate";
}

function candidateSubtitle(candidate: Row | null | undefined) {
  const title = pickString(candidate?.current_title);
  const company = pickString(candidate?.current_company_name);
  return [title, company].filter(Boolean).join(" at ") || pickString(candidate?.location) || "-";
}

function documentState(document: Row | null) {
  if (!document) return "Missing";
  const status = pickString(document.status) ?? "uploaded";
  if (status === "parsed") return "Parsed";
  if (status === "processing") return "Processing";
  if (status === "failed") return "Failed";
  return "Uploaded";
}

function linkedinState(verification: Row | null, candidate: Row | null | undefined) {
  if (!verification && !pickString(candidate?.linkedin_url)) return "Missing";
  if (!verification) return "Pending";
  const status = pickString(verification.status) ?? "pending";
  if (status === "verified") return "Verified";
  if (status === "error" || status === "mismatch" || status === "not_found") return "Failed";
  return "Pending";
}

function recommendation(fitScore: number | null, trustScore: number | null, stored?: unknown) {
  const existing = pickString(stored);
  if (existing) return existing;
  if ((fitScore ?? 0) >= 80 && (trustScore ?? 100) >= 75) return "Strong match";
  if ((fitScore ?? 100) < 55 || (trustScore ?? 100) < 55) return "Reject";
  return fitScore === null && trustScore === null ? "Not analyzed" : "Review";
}

function statusForCandidate(candidate: Row, fitScore: number | null, linkedin: string, document: string) {
  if (fitScore !== null) return "Analyzed";
  if (linkedin === "Verified" && document === "Parsed") return "Verified";
  const status = pickString(candidate.status);
  return status ? status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " ") : "Imported";
}

function scoreFromMission(candidateMission: Row | null, key: "fit_score" | "trust_score") {
  return roundScore(candidateMission?.[key]);
}

function bestCandidateMission(candidateMissions: Row[]) {
  return [...candidateMissions].sort((a, b) => {
    const aFit = pickNumber(a.fit_score) ?? -1;
    const bFit = pickNumber(b.fit_score) ?? -1;
    const aUpdated = pickString(a.updated_at, a.created_at) ?? "";
    const bUpdated = pickString(b.updated_at, b.created_at) ?? "";
    if (bFit !== aFit) return bFit - aFit;
    return new Date(bUpdated).getTime() - new Date(aUpdated).getTime();
  })[0] ?? null;
}


function missionTitle(candidateMission: Row | null) {
  const mission = asObject(candidateMission?.mission);
  return pickString(mission.title) ?? "-";
}

export const getCandidatesWorkspaceData = cache(async () => {
  const { supabase, companyId } = await getHrContext();

  const [
    candidateResponse,
    candidateMissionResponse,
    documentResponse,
    verificationResponse,
    inconsistencyResponse,
    sessionResponse,
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select("*")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("candidate_missions")
      .select("*, mission:missions(id, title, status, department, location, updated_at)")
      .eq("company_id", companyId),
    supabase
      .from("candidate_documents")
      .select("id, candidate_id, mission_id, document_type, status, file_name, file_path, mime_type, file_size_bytes, created_at, updated_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("linkedin_verifications")
      .select("id, candidate_id, status, profile_name, headline, current_company, location, confidence_score, profile_image_url, checked_at, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("candidate_inconsistencies")
      .select("id, candidate_id, status, severity, description, created_at, updated_at")
      .eq("company_id", companyId),
    supabase
      .from("pipeline_sessions")
      .select("id, candidate_id, mission_id, status, submitted_at, analyzed_at, created_at, updated_at")
      .eq("company_id", companyId),
  ]);

  for (const response of [
    candidateResponse,
    candidateMissionResponse,
    documentResponse,
    verificationResponse,
    inconsistencyResponse,
    sessionResponse,
  ]) {
    if (response.error) throw new Error(response.error.message || "Unable to load candidates");
  }

  const candidateMissionsByCandidate = byKey(rows(candidateMissionResponse.data), "candidate_id");
  const documentsByCandidate = byKey(rows(documentResponse.data), "candidate_id");
  const verificationsByCandidate = byKey(rows(verificationResponse.data), "candidate_id");
  const inconsistenciesByCandidate = byKey(rows(inconsistencyResponse.data), "candidate_id");
  const sessionsByCandidate = byKey(rows(sessionResponse.data), "candidate_id");

  const allDocuments = rows(documentResponse.data);
  const resumeDocuments = allDocuments.filter(doc => pickString(doc.document_type) === "resume");
  const uniqueResumePaths = Array.from(new Set(resumeDocuments.map(doc => pickString(doc.file_path)).filter((p): p is string => Boolean(p))));
  
  const signedUrlsResponse = uniqueResumePaths.length > 0
    ? await supabase.storage.from("candidate-cvs").createSignedUrls(uniqueResumePaths, 3600)
    : { data: [], error: null };
  
  const cvUrlMap = new Map((signedUrlsResponse.data ?? []).map((item: { path: string; signedUrl: string }) => [item.path, item.signedUrl]));


  const candidates = rows(candidateResponse.data).map((candidate) => {
    const id = pickString(candidate.id) ?? "";
    const candidateMissions = candidateMissionsByCandidate.get(id) ?? [];
    const selectedMission = bestCandidateMission(candidateMissions);
    const latestDocument = latest(documentsByCandidate.get(id) ?? []);
    const latestVerification = latest(verificationsByCandidate.get(id) ?? []);
    const sessions = sessionsByCandidate.get(id) ?? [];
    const inconsistencies = inconsistenciesByCandidate.get(id) ?? [];
    const fitScore = scoreFromMission(selectedMission, "fit_score");
    const trustScore = scoreFromMission(selectedMission, "trust_score");
    const cv = documentState(latestDocument);
    const linkedin = linkedinState(latestVerification, candidate);
    const submittedSessions = sessions.filter((session) => {
      const status = pickString(session.status);
      return status === "submitted" || status === "analyzed";
    }).length;
    const lastActivity = latest([
      candidate,
      ...candidateMissions,
      ...(documentsByCandidate.get(id) ?? []),
      ...(verificationsByCandidate.get(id) ?? []),
      ...sessions,
    ]);

    const metadata = asObject(candidate.metadata);
    const avatarUrl = pickString(latestVerification?.profile_image_url) ?? 
                     pickString(metadata.profile_image_url) ?? 
                     pickString(metadata.photo_url) ??
                     null;

    return {
      id,
      candidate,
      name: fullName(candidate),
      avatarUrl,
      subtitle: candidateSubtitle(candidate),
      email: pickString(candidate.email) ?? "-",
      location: pickString(candidate.location) ?? "-",
      currentRole: pickString(candidate.current_title) ?? "-",
      currentCompany: pickString(candidate.current_company_name) ?? "-",
      linkedinUrl: pickString(candidate.linkedin_url),
      source: pickString(candidate.source) ?? "manual",
      status: statusForCandidate(candidate, fitScore, linkedin, cv),
      cv,
      linkedin,
      fitScore,
      trustScore,
      recommendation: recommendation(fitScore, trustScore, selectedMission?.recommendation),
      missionCount: candidateMissions.length,
      missionTitle: missionTitle(selectedMission),
      submittedSessions,
      openIssues: inconsistencies.filter((item) => pickString(item.status) === "open").length,
      lastActivity: relativeTime(lastActivity?.updated_at ?? lastActivity?.checked_at ?? lastActivity?.created_at),
      createdAt: formatDate(candidate.created_at),
      cvUrl: cvUrlMap.get(pickString(latestDocument?.file_path) ?? "") ?? null,
    };
  });

  return {
    candidates,
    summary: {
      total: candidates.length,
      analyzed: candidates.filter((candidate) => candidate.fitScore !== null || candidate.trustScore !== null).length,
      verified: candidates.filter((candidate) => candidate.linkedin === "Verified").length,
      strongMatches: candidates.filter((candidate) => candidate.recommendation === "Strong match").length,
      avgFit: average(candidates.map((candidate) => candidate.fitScore)),
    },
  };
});

export const getCandidateDetailData = cache(async (candidateId: string) => {
  const { supabase, companyId } = await getHrContext();

  const [
    candidateResponse,
    missionResponse,
    documentResponse,
    verificationResponse,
    scoreResponse,
    signalResponse,
    inconsistencyResponse,
    sessionResponse,
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", candidateId)
      .maybeSingle(),
    supabase
      .from("candidate_missions")
      .select("*, mission:missions(id, title, status, department, location)")
      .eq("company_id", companyId)
      .eq("candidate_id", candidateId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("candidate_documents")
      .select("*")
      .eq("company_id", companyId)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false }),
    supabase
      .from("linkedin_verifications")
      .select("*")
      .eq("company_id", companyId)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false }),
    supabase
      .from("candidate_scores")
      .select("*")
      .eq("company_id", companyId)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false }),
    supabase
      .from("candidate_signals")
      .select("*")
      .eq("company_id", companyId)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false }),
    supabase
      .from("candidate_inconsistencies")
      .select("*")
      .eq("company_id", companyId)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false }),
    supabase
      .from("pipeline_sessions")
      .select("*, pipeline:pipelines(id, name, status, mission_id)")
      .eq("company_id", companyId)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false }),
  ]);

  for (const response of [
    candidateResponse,
    missionResponse,
    documentResponse,
    verificationResponse,
    scoreResponse,
    signalResponse,
    inconsistencyResponse,
    sessionResponse,
  ]) {
    if (response.error) throw new Error(response.error.message || "Unable to load candidate");
  }

  if (!candidateResponse.data) return null;

  const candidate = asObject(candidateResponse.data);
  const missions = rows(missionResponse.data).map((candidateMission) => {
    const mission = asObject(candidateMission.mission);
    const fitScore = roundScore(candidateMission.fit_score);
    const trustScore = roundScore(candidateMission.trust_score);

    return {
      id: pickString(candidateMission.id) ?? "",
      applicationId: pickString(mission.id, candidateMission.mission_id) ?? "",
      title: pickString(mission.title) ?? "Mission",
      team: pickString(mission.department) ?? "-",
      location: pickString(mission.location) ?? "-",
      status: pickString(candidateMission.status) ?? "new",
      fitScore,
      trustScore,
      recommendation: recommendation(fitScore, trustScore, candidateMission.recommendation),
      updatedAt: relativeTime(candidateMission.updated_at ?? candidateMission.created_at),
    };
  });
  const documents = rows(documentResponse.data);
  const verifications = rows(verificationResponse.data);
  const scores = rows(scoreResponse.data);
  const signals = rows(signalResponse.data);
  const inconsistencies = rows(inconsistencyResponse.data);
  const sessions = rows(sessionResponse.data);
  const selectedMission = bestCandidateMission(rows(missionResponse.data));
  const fitScore = scoreFromMission(selectedMission, "fit_score");
  const trustScore = scoreFromMission(selectedMission, "trust_score");
  const cv = documentState(latest(documents));
  const linkedin = linkedinState(latest(verifications), candidate);

  return {
    candidate,
    name: fullName(candidate),
    subtitle: candidateSubtitle(candidate),
    status: statusForCandidate(candidate, fitScore, linkedin, cv),
    cv,
    linkedin,
    fitScore,
    trustScore,
    recommendation: recommendation(fitScore, trustScore, selectedMission?.recommendation),
    missions,
    applications: missions,
    documents: documents.map((document) => ({
      id: pickString(document.id) ?? "",
      name: pickString(document.file_name) ?? "Document",
      type: pickString(document.document_type) ?? "document",
      status: documentState(document),
      size: pickNumber(document.file_size_bytes),
      createdAt: formatDate(document.created_at),
      updatedAt: relativeTime(document.updated_at ?? document.created_at),
    })),
    verifications: verifications.map((verification) => ({
      id: pickString(verification.id) ?? "",
      status: linkedinState(verification, candidate),
      profileName: pickString(verification.profile_name) ?? "-",
      headline: pickString(verification.headline) ?? "-",
      company: pickString(verification.current_company) ?? "-",
      confidence: roundScore(verification.confidence_score),
      checkedAt: relativeTime(verification.checked_at ?? verification.created_at),
    })),
    scores: scores.map((score) => ({
      id: pickString(score.id) ?? "",
      type: pickString(score.score_type) ?? "score",
      value: roundScore(score.score),
      level: pickString(score.level) ?? "-",
      explanation: pickString(score.explanation) ?? "-",
      scoredAt: relativeTime(score.scored_at ?? score.created_at),
    })),
    signals: signals.map((signal) => ({
      id: pickString(signal.id) ?? "",
      type: pickString(signal.signal_type) ?? "neutral",
      label: pickString(signal.label) ?? "Signal",
      description: pickString(signal.description) ?? "-",
      weight: pickNumber(signal.weight),
    })),
    inconsistencies: inconsistencies.map((item) => ({
      id: pickString(item.id) ?? "",
      severity: pickString(item.severity) ?? "medium",
      status: pickString(item.status) ?? "open",
      field: pickString(item.field_name) ?? "-",
      description: pickString(item.description) ?? "Inconsistency detected.",
      updatedAt: relativeTime(item.updated_at ?? item.created_at),
    })),
    sessions: sessions.map((session) => {
      const pipeline = asObject(session.pipeline);
      return {
        id: pickString(session.id) ?? "",
        pipelineName: pickString(pipeline.name) ?? "Pipeline",
        status: pickString(session.status) ?? "opened",
        submittedAt: pickString(session.submitted_at) ? formatDate(session.submitted_at) : "-",
        updatedAt: relativeTime(session.updated_at ?? session.created_at),
      };
    }),
  };
});
