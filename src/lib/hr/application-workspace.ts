import { cache } from "react";
import { getHrContext } from "@/lib/hr/auth";
import { asObject, formatDate, normalizeImportedCandidateName, pickString, relativeTime } from "@/lib/hr/utils";
import { getMissionWorkSamples } from "./work-samples";
import { fetchLinkedInPublicPhoto } from "./linkedin-photo";
import { storeCandidateProfileImage } from "./profile-images";

export type ApplicationRow = Record<string, unknown>;
export type CandidateRow = Record<string, unknown>;
export type CandidateApplicationRow = Record<string, unknown> & {
  candidate?: CandidateRow | null;
};

type IndexedRows = Map<string, Record<string, unknown>[]>;

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function byKey(items: Record<string, unknown>[], key: string): IndexedRows {
  const map = new Map<string, Record<string, unknown>[]>();

  for (const item of items) {
    const id = pickString(item[key]);
    if (!id) continue;
    const current = map.get(id) ?? [];
    current.push(item);
    map.set(id, current);
  }

  return map;
}

function latest(items: Record<string, unknown>[], fields: string[] = ["updated_at", "checked_at", "created_at"]) {
  return [...items].sort((a, b) => {
    const aDate = fields.map((field) => pickString(a[field])).find(Boolean) ?? "";
    const bDate = fields.map((field) => pickString(b[field])).find(Boolean) ?? "";
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  })[0] ?? null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function roundScore(value: number | null) {
  return value === null ? null : Math.round(value);
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}



function missionDisplayStatus(mission: ApplicationRow, candidateCount: number, analyzedCount: number) {
  const status = pickString(mission.status) ?? "draft";
  if (status === "draft") return "Draft";
  if (status === "closed" || status === "archived") return "Completed";
  return "Active";
}

const COPY_INTEGRITY_EVENTS = new Set(["paste_attempt", "copy_attempt", "cut_attempt", "context_menu_opened", "drag_drop_attempt"]);

function lockedPipelineResponse(response: Record<string, unknown>) {
  const status = pickString(response.status);
  return response.is_locked === true || status === "locked" || status === "submitted" || status === "timed_out";
}

function sessionCompleted(session: Record<string, unknown>, completed: number, total: number) {
  const status = pickString(session.status);
  if (status === "submitted" || status === "analyzed" || status === "completed") return true;
  if (total > 0 && completed >= total) return true;
  return Boolean(pickString(session.completed_at));
}

export function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("active") || normalized.includes("verified") || normalized.includes("strong") || normalized.includes("parsed")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized.includes("analyzing") || normalized.includes("review") || normalized.includes("pending") || normalized.includes("draft")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (normalized.includes("failed") || normalized.includes("reject") || normalized.includes("missing") || normalized.includes("low")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (normalized.includes("completed") || normalized.includes("submitted")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-border bg-secondary text-foreground/70";
}

export function fullName(candidate: CandidateRow | null | undefined) {
  const rawProfile = asObject(candidate?.raw_profile);
  const candidateMetadata = asObject(candidate?.metadata);
  const normalized = normalizeImportedCandidateName({
    fullName: pickString(candidateMetadata.display_name, rawProfile.Name, rawProfile["Full Name"], rawProfile["Contact Name"], rawProfile["Person Name"]),
    firstName: candidate?.first_name,
    lastName: candidate?.last_name,
  });

  return normalized.displayName || pickString(candidate?.email) || "Unnamed candidate";
}

export function candidateSubtitle(candidate: CandidateRow | null | undefined) {
  const title = pickString(candidate?.current_title);
  const company = pickString(candidate?.current_company_name);
  return [title, company].filter(Boolean).join(" at ") || pickString(candidate?.location) || "-";
}

function recommendation(fitScore: number | null, trustScore: number | null, stored?: unknown) {
  const existing = pickString(stored);
  if (existing) return existing;
  if ((fitScore ?? 0) >= 80 && (trustScore ?? 100) >= 75) return "Strong match";
  if ((fitScore ?? 100) < 55 || (trustScore ?? 100) < 55) return "Reject";
  return "Review";
}

function sourceType(candidateMission: Record<string, unknown> | null | undefined) {
  const value = pickString(candidateMission?.source_type);
  return value === "application" ? "application" : "sourcing";
}

function sourcingRecommendation(fitScore: number | null, opportunityScore: number | null, stored?: unknown) {
  const existing = displaySourcingRecommendation(stored);
  if (existing) return existing;
  if ((fitScore ?? 0) >= 80 && (opportunityScore ?? 0) >= 75) return "Contact first";
  if ((fitScore ?? 0) < 55) return "Low fit";
  return "Review";
}

function displaySourcingRecommendation(value: unknown) {
  const normalized = pickString(value)?.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (!normalized) return null;
  if (normalized === "strong_match" || normalized === "contact_first" || normalized === "strong") return "Contact first";
  if (normalized === "manual_review" || normalized === "review" || normalized === "review_needed" || normalized === "review_recommended") return "Review";
  if (normalized === "low_fit" || normalized === "weak_match") return "Low fit";
  if (normalized === "do_not_contact" || normalized === "reject" || normalized === "rejected") return "Do not contact";
  return pickString(value);
}

function normalizedRecommendation(value: unknown) {
  return pickString(value)?.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_") ?? "";
}

function isDoNotContactRecommendation(value: unknown) {
  const normalized = normalizedRecommendation(value);
  return normalized === "do_not_contact" || normalized === "low_fit" || normalized === "weak_match" || normalized === "reject" || normalized === "rejected";
}

function isInvalidWhyNowFallback(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("not relevant") || normalized.includes("does not fit the mission");
}

function firstStringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : fallback;
}

const MAX_KEY_SIGNALS = 5;
const NON_BUSINESS_SIGNAL_KEYWORDS = [
  "linkedin verification",
  "verification confidence",
  "confidence score",
  "profile completeness",
  "linkedin url",
  "source relevance",
  "source url",
  "tavily",
  "metadata",
  "company research",
  "company signal",
  "public activity",
  "activity signal",
  "job-search",
  "job search",
  "openness to change",
  "insufficient evidence",
  "uncertain match",
];

function cleanSignalLabel(value: string) {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/\s+\u2013\s+/g, " - ")
    .split(/\s+-\s+/)[0]
    .trim();
  return cleaned.length > 110 ? `${cleaned.slice(0, 107).trim()}...` : cleaned;
}

function isBusinessSignalText(value: string) {
  const normalized = value.toLowerCase();
  if (!normalized) return false;
  if (/^(no|not|missing|unclear|uncertain|need to|needs to|lack|lacks)\b/.test(normalized)) return false;
  return !NON_BUSINESS_SIGNAL_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function uniqueLimited(items: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const cleaned = cleanSignalLabel(item);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= limit) break;
  }

  return result;
}

function reasonForCandidate(candidate: CandidateRow | null, fitScore: number | null, trustScore: number | null) {
  const summary = pickString(candidate?.summary);
  if (summary) return summary;
  if ((fitScore ?? 0) >= 80 && (trustScore ?? 0) >= 80) {
    return "Strong role fit with a coherent profile signal.";
  }
  if ((trustScore ?? 100) < 60) {
    return "Promising profile, but trust signals need a closer review.";
  }
  if ((fitScore ?? 0) < 60) {
    return "Limited fit against the current mission criteria.";
  }
  return "Profile should be reviewed with the mission context.";
}

function whyThisSourcingProfile(candidate: CandidateRow | null, fitScore: number | null, metadata: Record<string, unknown>, recommendation?: string | null) {
  if (isDoNotContactRecommendation(recommendation) || (fitScore ?? 0) < 30) {
    return "Profile does not match mission requirements.";
  }
  const stored = pickString(metadata.why_this_profile, metadata.analysis_reason);
  if (stored) return stored;
  const summary = pickString(candidate?.summary);
  if (summary) return summary;
  if ((fitScore ?? 0) >= 80) return "Strong role fit based on current role and mission context.";
  if ((fitScore ?? 0) < 60) return "Review suggested for role alignment.";
  return "Profile should be reviewed against the mission before outreach.";
}

function whyNowForSourcing(candidate: CandidateRow | null, fitScore: number | null, metadata: Record<string, unknown>, recommendation?: string | null) {
  const effectiveFitScore = fitScore ?? numberValue(metadata.fit_score);
  if (isDoNotContactRecommendation(recommendation) || (effectiveFitScore ?? 0) < 30) {
    return null;
  }
  const stored = pickString(metadata.why_now);
  if (stored && !isInvalidWhyNowFallback(stored)) return stored;
  if ((effectiveFitScore ?? 0) >= 75) return "Timing not confirmed but profile fit is strong.";
  if (pickString(candidate?.linkedin_url)) return "LinkedIn context is available for outreach timing review.";
  return "LinkedIn verification is still needed before prioritizing outreach.";
}

function suggestedSourcingAngle(candidate: CandidateRow | null, fitScore: number | null, metadata: Record<string, unknown>, recommendation?: string | null) {
  const effectiveFitScore = fitScore ?? numberValue(metadata.fit_score);
  if (isDoNotContactRecommendation(recommendation) || (effectiveFitScore ?? 100) < 30) {
    return null;
  }
  const stored = pickString(metadata.suggested_angle);
  if (stored) return stored;
  const title = pickString(candidate?.current_title);
  if (title) return `Open with the relevance of their ${title} experience to this mission.`;
  return "Open with the mission context and ask whether the timing is relevant.";
}

function sourcingRisks(candidate: CandidateRow | null, metadata: Record<string, unknown>) {
  const risks = sourcingRiskLabels(metadata);
  if (risks.length > 0) return risks;
  if (!pickString(candidate?.linkedin_url)) return ["LinkedIn URL is missing."];
  return ["No major sourcing risk detected from available data."];
}

function sourcingSignalLabels(metadata: Record<string, unknown>) {
  if (Array.isArray(metadata.signals)) {
    const signals = metadata.signals
      .map((signal) => {
        const obj = asObject(signal);
        return pickString(obj.label, obj.description);
      })
      .filter((item): item is string => Boolean(item && isBusinessSignalText(item)));
    const limitedSignals = uniqueLimited(signals, MAX_KEY_SIGNALS);
    if (limitedSignals.length > 0) return limitedSignals;
  }

  const signalLabels = firstStringArray(metadata.signal_labels)
    .filter((item) => isBusinessSignalText(item));
  const limitedSignalLabels = uniqueLimited(signalLabels, MAX_KEY_SIGNALS);
  if (limitedSignalLabels.length > 0) return limitedSignalLabels;

  return uniqueLimited([
    ...evidenceSignalLabels(metadata.facts),
    ...evidenceSignalLabels(metadata.inferences),
    ...evidenceSignalLabels(metadata.hypotheses),
  ], MAX_KEY_SIGNALS);
}

function evidenceSignalLabels(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map(asObject)
    .filter((item) => {
      const type = pickString(item.type)?.toLowerCase();
      const category = pickString(item.category)?.toLowerCase() ?? "";
      return (
        type !== "mismatch" &&
        type !== "negative" &&
        type !== "risk" &&
        !category.includes("mismatch") &&
        !category.includes("risk") &&
        !category.includes("exclusion")
      );
    })
      .map((item) => pickString(item.label, item.category, item.description))
      .filter((item): item is string => Boolean(item && isBusinessSignalText(item)));
}

function sourcingRiskLabels(metadata: Record<string, unknown>) {
  const risks = Array.isArray(metadata.risks)
    ? metadata.risks
      .map((risk) => {
        if (typeof risk === "string") return risk;
        const obj = asObject(risk);
        return pickString(obj.label, obj.description);
      })
      .filter((item): item is string => Boolean(item))
    : [];

  return uniqueLimited(risks, 5);
}

function riskForCandidate(inconsistencies: Record<string, unknown>[], trustScore: number | null) {
  const openIssue = inconsistencies.find((item) => pickString(item.status) === "open");
  if (openIssue) return pickString(openIssue.description) || "Open inconsistency detected.";
  if ((trustScore ?? 100) < 60) return "Low trust score.";
  return "None detected.";
}

function cvState(document: Record<string, unknown> | null) {
  if (!document) return { label: "Missing", status: "missing" };
  const status = pickString(document.status) ?? "uploaded";
  if (status === "parsed") return { label: "Parsed", status };
  if (status === "failed") return { label: "Failed", status };
  if (status === "processing") return { label: "Processing", status };
  return { label: "Uploaded", status };
}

function linkedinState(verification: Record<string, unknown> | null, candidate: CandidateRow | null) {
  if (!verification && !pickString(candidate?.linkedin_url)) return { label: "Missing", status: "missing" };
  if (!verification) return { label: "Pending", status: "pending" };
  const status = pickString(verification.status) ?? "pending";
  if (status === "verified") return { label: "Verified", status };
  if (status === "error" || status === "mismatch" || status === "not_found") return { label: "Failed", status };
  return { label: "Pending", status };
}

function workStatus(fitScore: number | null, linkedinLabel: string) {
  if (fitScore !== null) return "Analyzed";
  if (linkedinLabel === "Verified") return "Verified";
  return "Imported";
}

function profileImageUrl(candidate: CandidateRow | null | undefined, verification: Record<string, unknown> | null) {
  const candidateMetadata = asObject(candidate?.metadata);
  const rawProfile = asObject(candidate?.raw_profile);
  const verificationData = asObject(verification?.verification_data);

  const directUrl = pickString(
    verification?.profile_image_url,
    verificationData.profile_image_url,
    verificationData.profileImageUrl,
    candidateMetadata.profile_image_url,
    candidateMetadata.profileImageUrl,
    rawProfile["Profile Image URL"],
    rawProfile["Profile Photo URL"],
    rawProfile["Photo URL"],
    rawProfile["Photo Url"],
    rawProfile["Picture URL"],
    rawProfile["Avatar URL"],
  );

  if (directUrl) return directUrl;

  for (const source of [verificationData, candidateMetadata, rawProfile]) {
    for (const [key, value] of Object.entries(source)) {
      const normalizedKey = key.toLowerCase().replace(/[_-]+/g, " ");
      const looksLikeImageKey =
        normalizedKey.includes("photo") ||
        normalizedKey.includes("picture") ||
        normalizedKey.includes("image") ||
        normalizedKey.includes("avatar");
      const url = pickString(value);

      if (looksLikeImageKey && url && /^https?:\/\//i.test(url)) return url;
    }
  }

  return null;
}

export function salaryLabel(application: ApplicationRow) {
  const min = numberValue(application.salary_min);
  const max = numberValue(application.salary_max);
  const currency = pickString(application.salary_currency) ?? "EUR";

  if (min === null && max === null) return "-";
  if (min !== null && max !== null) return `${Math.round(min / 1000)}k-${Math.round(max / 1000)}k ${currency}`;
  if (min !== null) return `From ${Math.round(min / 1000)}k ${currency}`;
  return `Up to ${Math.round((max ?? 0) / 1000)}k ${currency}`;
}

export function metadata(application: ApplicationRow) {
  return asObject(application.metadata);
}

async function getMissionHrContext() {
  return await getHrContext();
}

export const getApplicationListData = cache(async () => {
  const { supabase, companyId } = await getMissionHrContext();

  const [missionResponse, candidateMissionResponse, sessionResponse, usageResponse] = await Promise.all([
    supabase
      .from("missions")
      .select("*, manager:users(first_name, last_name, email, avatar_url)")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("candidate_missions")
      .select("id, mission_id, source_type, fit_score, trust_score, opportunity_score, status, created_at, updated_at")
      .eq("company_id", companyId),
    supabase
      .from("pipeline_sessions")
      .select("id, mission_id, status, created_at, updated_at, submitted_at, analyzed_at")
      .eq("company_id", companyId),
    supabase
      .from("usage_logs")
      .select("id, mission_id, event_type, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (missionResponse.error) throw new Error(missionResponse.error.message || "Unable to load missions");
  if (candidateMissionResponse.error) throw new Error(candidateMissionResponse.error.message || "Unable to load mission candidates");
  if (sessionResponse.error) throw new Error(sessionResponse.error.message || "Unable to load pipeline sessions");
  if (usageResponse.error) throw new Error(usageResponse.error.message || "Unable to load usage activity");

  const candidateMissionsByMission = byKey(rows(candidateMissionResponse.data), "mission_id");
  const sessionsByMission = byKey(rows(sessionResponse.data), "mission_id");
  const usageByMission = byKey(rows(usageResponse.data), "mission_id");

  const applications = rows(missionResponse.data).map((mission) => {
    const applicationId = String(mission.id);
    const candidateMissions = candidateMissionsByMission.get(applicationId) ?? [];
    const sourcingMissions = candidateMissions.filter((item) => sourceType(item) === "sourcing");
    const applicationMissions = candidateMissions.filter((item) => sourceType(item) === "application");
    const sessions = sessionsByMission.get(applicationId) ?? [];
    const usage = usageByMission.get(applicationId) ?? [];
    const analyzedCount = sourcingMissions.filter((item) => numberValue(item.fit_score) !== null || numberValue(item.opportunity_score) !== null).length;
    const avgFit = average(sourcingMissions.map((item) => numberValue(item.fit_score)));
    const lastActivity =
      latest([...candidateMissions, ...sessions, ...usage, mission ? [mission] : []].flat()) ??
      mission;

    return {
      mission,
      id: applicationId,
      title: pickString(mission.title) ?? "Untitled mission",
      team: pickString(mission.department) ?? "-",
      location: pickString(mission.location) ?? pickString(mission.remote_policy) ?? "-",
      candidateCount: sourcingMissions.length,
      applicationCount: Math.max(sessions.length, applicationMissions.length),
      analyzedCount,
      avgFit,
      status: missionDisplayStatus(mission, candidateMissions.length, analyzedCount),
      lastUpdate: relativeTime(lastActivity?.updated_at ?? lastActivity?.created_at),
      lastActivityType: pickString(lastActivity?.event_type) ?? "application_update",
      workflowType: pickString(asObject(mission.metadata).workflow_type) ?? 
        (asObject(mission.metadata).import_list_name || asObject(mission.metadata).qualification_goal ? "sourcing" : "application"),
      manager: [
        pickString(asObject(mission.manager).first_name),
        pickString(asObject(mission.manager).last_name)
      ].filter(Boolean).join(" ") || pickString(asObject(mission.manager).email) || "-",
      managerAvatar: pickString(asObject(mission.manager).avatar_url),
    };
  });

  return { applications };
});

export const getMissionListData = cache(async () => {
  const data = await getApplicationListData();
  return { missions: data.applications };
});

export const getApplicationWorkspaceData = cache(async (applicationId: string) => {
  const { supabase, companyId } = await getMissionHrContext();

  const [missionResponse, candidateMissionResponse, pipelineResponse, teamResponse] = await Promise.all([
    supabase
      .from("missions")
      .select("*, manager:users(id, first_name, last_name, email, avatar_url)")
      .eq("company_id", companyId)
      .eq("id", applicationId)
      .maybeSingle(),
    supabase
      .from("candidate_missions")
      .select("*, candidate:candidates(*)")
      .eq("company_id", companyId)
      .eq("mission_id", applicationId)
      .order("fit_score", { ascending: false, nullsFirst: false })
      .order("trust_score", { ascending: false, nullsFirst: false }),
    supabase
      .from("pipelines")
      .select("*")
      .eq("company_id", companyId)
      .eq("mission_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, first_name, last_name, email, avatar_url")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("first_name", { ascending: true }),
  ]);

  if (missionResponse.error) throw new Error(missionResponse.error.message || "Unable to load mission");
  if (candidateMissionResponse.error) throw new Error(candidateMissionResponse.error.message || "Unable to load candidates");
  if (pipelineResponse.error) throw new Error(pipelineResponse.error.message || "Unable to load pipeline");
  if (teamResponse.error) throw new Error(teamResponse.error.message || "Unable to load team members");
  if (!missionResponse.data) return null;

  const allCandidateMissions = rows(candidateMissionResponse.data) as CandidateApplicationRow[];
  const sourcingCandidateMissions = allCandidateMissions.filter((item) => sourceType(item) === "sourcing");
  const candidateIds = allCandidateMissions
    .map((item) => pickString(asObject(item.candidate).id, item.candidate_id))
    .filter((id): id is string => Boolean(id));
  const pipeline = pipelineResponse.data ? asObject(pipelineResponse.data) : null;
  const pipelineId = pickString(pipeline?.id);

  const [
    documentResponse,
    verificationResponse,
    inconsistencyResponse,
    sessionResponse,
    pipelineScoreResponse,
    stepResponse,
    questionResponse,
    workSamplesResponse,
  ] = await Promise.all([
    candidateIds.length
      ? supabase.from("candidate_documents").select("*").eq("company_id", companyId).in("candidate_id", candidateIds)
      : Promise.resolve({ data: [], error: null }),
    candidateIds.length
      ? supabase.from("linkedin_verifications").select("*").eq("company_id", companyId).in("candidate_id", candidateIds)
      : Promise.resolve({ data: [], error: null }),
    candidateIds.length
      ? supabase.from("candidate_inconsistencies").select("*").eq("company_id", companyId).in("candidate_id", candidateIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("pipeline_sessions")
      .select("*")
      .eq("company_id", companyId)
      .eq("mission_id", applicationId)
      .order("created_at", { ascending: false }),
    pipelineId
      ? supabase.from("pipeline_scores").select("*").eq("company_id", companyId).eq("pipeline_id", pipelineId)
      : Promise.resolve({ data: [], error: null }),
    pipelineId
      ? supabase.from("pipeline_steps").select("*").eq("company_id", companyId).eq("pipeline_id", pipelineId).order("position", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    pipelineId
      ? supabase.from("pipeline_questions").select("*").eq("company_id", companyId).eq("pipeline_id", pipelineId).order("position", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    getMissionWorkSamples({ supabase, companyId, missionId: applicationId }),
  ]);

  const workSamples = Array.isArray(workSamplesResponse) ? workSamplesResponse : [];

  for (const response of [
    documentResponse,
    verificationResponse,
    inconsistencyResponse,
    sessionResponse,
    pipelineScoreResponse,
    stepResponse,
    questionResponse,
  ]) {
    if (response.error) throw new Error(response.error.message || "Unable to load mission workspace");
  }

  const documents = rows(documentResponse.data);
  const documentsByCandidate = byKey(documents, "candidate_id");
  const resumeDocuments = documents.filter(doc => pickString(doc.document_type) === "resume");
  const uniqueResumePaths = Array.from(new Set(resumeDocuments.map(doc => pickString(doc.file_path)).filter((p): p is string => Boolean(p))));
  
  const signedUrlsResponse = uniqueResumePaths.length > 0
    ? await supabase.storage.from("candidate-cvs").createSignedUrls(uniqueResumePaths, 3600)
    : { data: [], error: null };
  
  const cvUrlMap = new Map((signedUrlsResponse.data ?? []).map((item: { path: string; signedUrl: string }) => [item.path, item.signedUrl]));
  const verificationsByCandidate = byKey(rows(verificationResponse.data), "candidate_id");
  const inconsistenciesByCandidate = byKey(rows(inconsistencyResponse.data), "candidate_id");

  // Lazy photo retrieval for candidates with LinkedIn but no photo
  const candidateRows = allCandidateMissions.map(cm => asObject(cm.candidate)).filter(c => pickString(c.id));
  const candidatesNeedingPhotos = candidateRows.filter(c => {
    const id = pickString(c.id);
    const hasPhoto = profileImageUrl(c, latest(verificationsByCandidate.get(id ?? "") ?? []));
    return !hasPhoto && pickString(c.linkedin_url);
  }).slice(0, 5); // Limit to 5 per load to avoid slowing down too much

  if (candidatesNeedingPhotos.length > 0) {
    await Promise.all(candidatesNeedingPhotos.map(async (c) => {
      const id = pickString(c.id);
      const url = pickString(c.linkedin_url);
      if (!id || !url) return;
      
      const photoUrl = await fetchLinkedInPublicPhoto(url);
      if (photoUrl) {
        const storedUrl = await storeCandidateProfileImage(supabase, {
          companyId,
          candidateId: id,
          image: photoUrl
        });
        
        if (storedUrl) {
          await supabase.from("candidates").update({
            metadata: { ...asObject(c.metadata), profile_image_url: storedUrl }
          }).eq("id", id).eq("company_id", companyId);
        }
      }
    }));
  }

  const sessions = rows(sessionResponse.data);
  const sessionIds = sessions.map((session) => pickString(session.id)).filter((id): id is string => Boolean(id));
  const [responseResponse, eventResponse] = await Promise.all([
    sessionIds.length
      ? supabase
          .from("candidate_pipeline_responses")
          .select("*")
          .eq("company_id", companyId)
          .in("pipeline_session_id", sessionIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length
      ? supabase
          .from("pipeline_session_events")
          .select("*")
          .eq("company_id", companyId)
          .in("pipeline_session_id", sessionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (responseResponse.error) {
    throw new Error(responseResponse.error.message || "Unable to load application responses");
  }
  if (eventResponse.error) {
    throw new Error(eventResponse.error.message || "Unable to load application events");
  }

  const sessionsByCandidate = byKey(sessions, "candidate_id");
  const scoresBySession = byKey(rows(pipelineScoreResponse.data), "pipeline_session_id");
  const responsesBySession = byKey(rows(responseResponse.data), "pipeline_session_id");
  const eventsBySession = byKey(rows(eventResponse.data), "pipeline_session_id");
  const steps = rows(stepResponse.data);
  const stepsById = new Map(steps.map((step) => [String(step.id), step]));
  const questions = rows(questionResponse.data);
  const questionsById = new Map(questions.map((question) => [String(question.id), question]));

  const buildCandidate = (candidateMission: CandidateApplicationRow) => {
    const candidate = asObject(candidateMission.candidate);
    const candidateId = pickString(candidate.id, candidateMission.candidate_id) ?? "";
    const candidateDocuments = documentsByCandidate.get(candidateId) ?? [];
    const latestDocument = latest(candidateDocuments, ["updated_at", "created_at"]);
    const latestVerification = latest(verificationsByCandidate.get(candidateId) ?? [], ["checked_at", "created_at"]);
    const candidateInconsistencies = inconsistenciesByCandidate.get(candidateId) ?? [];
    const candidateSessions = sessionsByCandidate.get(candidateId) ?? [];
    const currentSession = latest(candidateSessions, ["updated_at", "submitted_at", "created_at"]);
    const fitScore = numberValue(candidateMission.fit_score);
    const trustScore = numberValue(candidateMission.trust_score);
    const opportunityScore = numberValue(candidateMission.opportunity_score);
    const candidateMissionMetadata = asObject(candidateMission.metadata);
    const cv = cvState(latestDocument);
    const linkedin = linkedinState(latestVerification, candidate);
    const cvUrl = latestDocument ? cvUrlMap.get(pickString(latestDocument.file_path) ?? "") : null;
    const flow = sourceType(candidateMission);
    const rec = flow === "sourcing"
      ? sourcingRecommendation(fitScore, opportunityScore, candidateMission.recommendation)
      : recommendation(fitScore, trustScore, candidateMission.recommendation);
    const sessionScore = currentSession ? latest(scoresBySession.get(String(currentSession.id)) ?? [], ["created_at"]) : null;

    return {
      id: candidateId,
      candidate,
      candidateMission,
      sourceType: flow,
      name: fullName(candidate),
      profileImageUrl: profileImageUrl(candidate, latestVerification),
      subtitle: candidateSubtitle(candidate),
      currentRole: pickString(candidate.current_title) ?? "-",
      currentCompany: pickString(candidate.current_company_name) ?? "-",
      location: pickString(candidate.location) ?? "-",
      fitScore: roundScore(fitScore),
      trustScore: roundScore(trustScore),
      opportunityScore: roundScore(opportunityScore),
      rawFitScore: fitScore,
      rawTrustScore: trustScore,
      rawOpportunityScore: opportunityScore,
      recommendation: rec,
      cv,
      linkedin,
      linkedinData: linkedin,
      status: workStatus(fitScore, linkedin.label),
      keyReason: reasonForCandidate(candidate, fitScore, trustScore),
      risk: riskForCandidate(candidateInconsistencies, trustScore),
      whyThisProfile: whyThisSourcingProfile(candidate, fitScore, candidateMissionMetadata, rec),
      whyNow: whyNowForSourcing(candidate, fitScore, candidateMissionMetadata, rec),
      suggestedAngle: suggestedSourcingAngle(candidate, fitScore, candidateMissionMetadata, rec),
      sourcingSignals: sourcingSignalLabels(candidateMissionMetadata),
      sourcingRisks: sourcingRisks(candidate, candidateMissionMetadata),
      teamFitScore: roundScore(numberValue(candidateMissionMetadata.team_fit_score)),
      linkedinCvCoherence: flow === "application" ? (pickString(candidateMissionMetadata.linkedin_cv_coherence) ?? (cv.label === "Parsed" && linkedin.label === "Verified" ? "Ready" : "Pending")) : null,
      inconsistencies: candidateInconsistencies,
      session: currentSession,
      cvUrl: cvUrl ?? pickString(latestDocument?.url, latestDocument?.public_url),
      linkedinUrl: pickString(candidate.linkedin_url),
      sessionStatus: pickString(currentSession?.status) ?? "not_created",
      sessionScore: roundScore(numberValue(sessionScore?.score)),
      why: [
        pickString(candidate.current_title)
          ? `${pickString(candidate.current_title)} experience is visible on the profile.`
          : "Current role should be confirmed.",
        fitScore !== null ? `Fit score is ${Math.round(fitScore)} against this mission.` : "Fit score is not calculated yet.",
        pickString(candidate.current_company_name)
          ? `Current company: ${pickString(candidate.current_company_name)}.`
          : "Current company is missing.",
        "Review should stay tied to the mission context and team expectations.",
      ],
      trustChecks: [
        linkedin.label === "Verified" ? "LinkedIn profile has been verified." : "LinkedIn verification is still needed.",
        flow === "application" && (cv.label === "Parsed" ? "CV has been parsed." : "CV parsing is still needed."),
        trustScore !== null ? `Trust score is ${Math.round(trustScore)}.` : "Trust score is not calculated yet.",
        candidateInconsistencies.length ? `${candidateInconsistencies.length} inconsistency item(s) found.` : "No major gaps detected.",
      ].filter((item): item is string => Boolean(item)),
    };
  };

  const allCandidates = allCandidateMissions.map(buildCandidate);
  const candidates = sourcingCandidateMissions.map(buildCandidate);

  const analyzedCount = candidates.filter((candidate) => candidate.rawFitScore !== null || candidate.rawOpportunityScore !== null).length;
  const verifiedCount = candidates.filter((candidate) => candidate.linkedin.label === "Verified").length;
  const parsedCount = allCandidates.filter((candidate) => candidate.sourceType === "application" && candidate.cv.label === "Parsed").length;
  const avgFit = average(candidates.map((candidate) => candidate.rawFitScore));
  const submittedSessions = sessions.filter((session) => {
    const status = pickString(session.status);
    return status === "submitted" || status === "analyzed";
  }).length;
  const lowFit = candidates.filter((candidate) => (candidate.rawFitScore ?? 100) < 60).length;
  const candidatesById = new Map(allCandidates.map((candidate) => [candidate.id, candidate]));
  const applicationSessions = sessions.map((session) => {
    const sessionId = pickString(session.id) ?? "";
    const candidateId = pickString(session.candidate_id) ?? "";
    const candidate = candidatesById.get(candidateId) ?? null;
    const scoreRow = latest(scoresBySession.get(sessionId) ?? [], ["created_at"]);
    const sessionResponses = responsesBySession.get(sessionId) ?? [];
    const lockedResponses = sessionResponses.filter(lockedPipelineResponse);
    const sessionEvents = eventsBySession.get(sessionId) ?? [];
    const pasteAttempts = sessionEvents.filter((event) => COPY_INTEGRITY_EVENTS.has(pickString(event.event_type) ?? "")).length;
    const tabSwitches = sessionEvents.filter((event) => pickString(event.event_type) === "tab_blur").length;
    const totalQuestions = questions.length || (numberValue(session.total_questions) ?? 0);
    const completedQuestions = lockedResponses.length;
    
    // Unusable answers detection
    const responses = sessionResponses.map((response) => {
      const question = response.question_id ? questionsById.get(String(response.question_id)) : null;
      const text = pickString(response.response_text) ?? "";
      const timeSpent = numberValue(response.time_spent_seconds) ?? 0;
      
      const isTooShort = text.length > 0 && text.length < 20;
      const isIncoherent = /^[a-z]{1,2}$/i.test(text) || /^[kjlhg=]{4,}$/i.test(text); // Basic incoherent check
      const isTooFast = text.length > 0 && timeSpent < 5;
      
      return {
        response,
        question,
        questionLabel: pickString(question?.label) ?? "Question",
        responseText: text || "-",
        isUnusable: isTooShort || isIncoherent || isTooFast,
        unusableReason: isTooShort ? "Too short" : isIncoherent ? "Incoherent" : isTooFast ? "Answered too fast" : null,
      };
    });

    const unusableCount = responses.filter(r => r.isUnusable).length;
    const unusableRatio = totalQuestions > 0 ? unusableCount / totalQuestions : 0;
    const isHighUnusable = unusableRatio >= 0.4;

    const averageTimePerAnswer = completedQuestions
      ? Math.round(lockedResponses.reduce((sum, response) => sum + (numberValue(response.time_spent_seconds) ?? 0), 0) / completedQuestions)
      : null;

    const complete = sessionCompleted(session, completedQuestions, totalQuestions);
    const status = pickString(session.status) ?? "opened";
    
    // Integrity assessment
    const reviewNeeded = 
      session.is_flagged === true || 
      pasteAttempts > 0 || 
      tabSwitches >= 3 || 
      status === "flagged" ||
      (complete && (averageTimePerAnswer ?? 100) < 15) ||
      isHighUnusable;

    const pipelineScore = roundScore(numberValue(scoreRow?.score));
    const finalScore = isHighUnusable ? (pipelineScore !== null && pipelineScore < 15 ? pipelineScore : 15) : pipelineScore;

    const completion = totalQuestions
      ? Math.round((completedQuestions / totalQuestions) * 100)
      : status === "submitted" || status === "analyzed"
        ? 100
        : 0;

    const criteria = asObject(scoreRow?.criteria);
    const candidateMissionMetadata = asObject(candidate?.candidateMission?.metadata);
    
    let recommendation = pickString(criteria.recommendation, candidateMissionMetadata.recommendation, candidate?.recommendation) ?? "Review";
    if (isHighUnusable) {
      recommendation = "Reject";
    }

    const strengths = Array.isArray(criteria.strengths)
      ? criteria.strengths.map((item) => typeof item === "string" ? item : pickString(asObject(item).label, asObject(item).description)).filter((item): item is string => Boolean(item))
      : Array.isArray(candidateMissionMetadata.strengths)
        ? candidateMissionMetadata.strengths.map((item) => typeof item === "string" ? item : pickString(asObject(item).label, asObject(item).description)).filter((item): item is string => Boolean(item))
      : isHighUnusable
        ? ["No clear strengths detected from the submitted answers."]
      : finalScore !== null && finalScore >= 80
        ? ["Strong response quality for the contextual pipeline."]
        : ["Application should be reviewed against the role context."];

    const risks = Array.isArray(criteria.risks)
      ? criteria.risks.map((item) => typeof item === "string" ? item : pickString(asObject(item).label, asObject(item).description)).filter((item): item is string => Boolean(item))
      : Array.isArray(candidateMissionMetadata.risks)
        ? candidateMissionMetadata.risks.map((item) => typeof item === "string" ? item : pickString(asObject(item).label, asObject(item).description)).filter((item): item is string => Boolean(item))
      : isHighUnusable
        ? [
            "Answers are too short or incoherent",
            ...(pasteAttempts > 0 ? [`${pasteAttempts} paste/copy attempts detected`] : []),
            ...(averageTimePerAnswer && averageTimePerAnswer < 15 ? ["Average response time is unusually low"] : []),
            "Unable to evaluate role fit from submitted answers"
          ]
      : finalScore !== null && finalScore < 60
        ? ["Pipeline score is below the target range."]
        : ["No major application risk detected."];

    return {
      id: sessionId,
      session,
      candidate,
      candidateId,
      name: candidate?.name ?? pickString(session.candidate_name) ?? "Unnamed applicant",
      profileImageUrl: candidate?.profileImageUrl ?? null,
      subtitle: candidate?.subtitle ?? pickString(session.candidate_email) ?? "-",
      status,
      responseStatus: complete ? "Completed" : status === "in_progress" ? "In progress" : status === "not_started" || status === "opened" ? "Not started" : status,
      pipelineScore: finalScore,
      fitScore: candidate?.fitScore ?? null,
      fitScoreLabel: isHighUnusable ? "Not reliable" : null,
      trustScore: candidate?.trustScore ?? null,
      teamFitScore: candidate?.teamFitScore ?? roundScore(numberValue(criteria.team_fit_score)),
      cvStatus: candidate?.cv.label ?? "Missing",
      linkedinStatus: candidate?.linkedin.label ?? "Missing",
      linkedinCvCoherence: candidate?.linkedinCvCoherence ?? pickString(criteria.linkedin_cv_coherence) ?? "Pending",
      linkedinUrl: candidate?.linkedinUrl ?? pickString(session.candidate_linkedin_url),
      cvUrl: candidate?.cvUrl ?? null,
      profileImageUrl: candidate?.profileImageUrl ?? null,
      completion,
      completionLabel: `${completedQuestions}/${totalQuestions || questions.length}`,
      integrityStatus: reviewNeeded ? "Review needed" : "Clean",
      pasteAttempts,
      tabSwitches,
      isFlagged: session.is_flagged === true,
      flagReason: pickString(session.flag_reason) || (
        isHighUnusable ? "Answers appear incomplete or unusable" :
        (complete && (averageTimePerAnswer ?? 100) < 15) ? "Average answer time is unusually low" :
        pasteAttempts > 0 ? `${pasteAttempts} paste/copy attempts detected` : null
      ),
      averageTimePerAnswer,
      strengths,
      risks,
      recommendation,
      score: scoreRow,
      responses,
      isHighUnusable,
      analysisStatus: scoreRow ? "Analyzed" : (complete ? "Pending" : "Not submitted"),
    };
  });

  const workflowType = pickString(asObject(missionResponse.data.metadata).workflow_type) ?? "application";
  return {
    companyId,
    application: asObject(missionResponse.data),
    workflowType,
    candidates,
    pipeline,
    workSamples,
    steps,
    questions: questions.map((question) => {
      const step = question.step_id ? stepsById.get(String(question.step_id)) : null;
      const stepType = pickString(step?.step_type) ?? "custom";
      const rules = asObject(question.validation_rules);
      const timeLimitSeconds = numberValue(rules.time_limit_seconds) ?? 180;

      return {
        question,
        step,
        typeLabel: stepType === "test" ? "Technical test" : stepType === "screening" ? "Scenario" : "Written answer",
        skillTested: pickString(rules.skill_tested, step?.name) ?? "Context awareness",
        difficulty: pickString(rules.difficulty, asObject(pipeline?.settings).difficulty, metadata(asObject(missionResponse.data)).difficulty_level) ?? "Medium",
        criteria: pickString(question.description) ?? "Clarity, reasoning, context awareness",
        timeLimit: timeLimitSeconds >= 60 ? `${Math.round(timeLimitSeconds / 60)} min` : `${timeLimitSeconds}s`,
        points: numberValue(rules.points) ?? numberValue(question.scoring_weight) ?? 10,
        requiresReasoning: rules.requires_reasoning === true,
        antiCheatLevel: pickString(rules.anti_cheat_level) ?? "low",
      };
    }),
    manager: asObject(asObject(missionResponse.data).manager),
    team: rows(teamResponse.data).map((user) => ({
      id: pickString(user.id),
      name: [pickString(user.first_name), pickString(user.last_name)].filter(Boolean).join(" ") || pickString(user.email) || "Member",
      email: pickString(user.email),
      avatarUrl: pickString(user.avatar_url),
    })),
    sessions,
    applicationSessions,
    progress: {
      candidatesImported: candidates.length,
      ...(workflowType === "application" ? { cvParsed: parsedCount } : {}),
      linkedinVerified: verifiedCount,
      analyzed: analyzedCount,
      pipelineSessionsSent: sessions.length,
      responsesReceived: submittedSessions,
      avgFit,
    },
    status: missionDisplayStatus(asObject(missionResponse.data), candidates.length, analyzedCount),
    alerts: [
      {
        label: `${Math.max(0, candidates.length - verifiedCount)} candidates missing LinkedIn verification`,
        active: candidates.length - verifiedCount > 0,
      },
      {
        label: `${candidates.filter((candidate) => candidate.rawOpportunityScore === null).length} profiles missing opportunity score`,
        active: candidates.some((candidate) => candidate.rawOpportunityScore === null),
      },
      {
        label: `${lowFit} profiles with low fit`,
        active: lowFit > 0,
      },
      {
        label: `${Math.max(0, candidates.length - analyzedCount)} candidates not analyzed yet`,
        active: candidates.length - analyzedCount > 0,
      },
    ],
    summary: {
      analyzedCount,
      strongMatches: candidates.filter((candidate) => candidate.recommendation === "Contact first" || candidate.recommendation === "Strong match").length,
      reviewNeeded: candidates.filter((candidate) => candidate.recommendation === "Review").length,
      rejected: candidates.filter((candidate) => candidate.recommendation === "Reject" || candidate.recommendation === "Low fit" || candidate.recommendation === "Do not contact").length,
    },
  };
});
