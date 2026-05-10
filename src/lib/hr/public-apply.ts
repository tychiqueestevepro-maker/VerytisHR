import { upsertCandidateMission } from "@/lib/hr/application-candidates";
import { createPipelineSession, getPipelineSessionByToken, identifyAndStartPipelineSession } from "@/lib/hr/pipeline-sessions";
import { createMissionPipeline, getMissionPipeline } from "@/lib/hr/pipeline";
import { assertUsageLimit, logUsageEvent } from "@/lib/hr/usage";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { asObject, normalizeEmail, pickString } from "./utils";

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

const CLOSED_MISSION_STATUSES = new Set(["paused", "closed", "archived"]);
const REUSABLE_SESSION_STATUSES = new Set([
  "not_started",
  "opened",
  "in_progress",
  "paused",
  "completed",
  "submitted",
  "analyzed",
  "flagged",
]);
const COMPLETED_SESSION_STATUSES = new Set(["completed", "submitted", "analyzed"]);

export function normalizePublicMissionSlug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function normalizeUrl(value: string | null) {
  return value?.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/g, "").toLowerCase() ?? null;
}

async function getEnabledMissionBySlug(supabase: SupabaseServiceClient, missionSlug: string) {
  const slug = normalizePublicMissionSlug(missionSlug);
  if (!slug) return null;

  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .eq("public_slug", slug)
    .eq("apply_enabled", true)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load public application");
  if (!data) return null;

  const mission = asObject(data);
  const status = pickString(mission.status) ?? "draft";
  if (CLOSED_MISSION_STATUSES.has(status)) return null;

  return mission;
}

async function ensureMissionPipeline(input: {
  supabase: SupabaseServiceClient;
  mission: Record<string, unknown>;
}) {
  const companyId = pickString(input.mission.company_id);
  const applicationId = pickString(input.mission.id);
  if (!companyId || !applicationId) throw new Error("Invalid application");

  const current = await getMissionPipeline(companyId, applicationId);
  if (current?.pipeline && current.questions.length > 0) return current;

  await assertUsageLimit({
    companyId,
    applicationId,
    eventType: "pipeline_generation",
  });

  const generated = await createMissionPipeline({
    companyId,
    applicationId,
    userId: pickString(input.mission.created_by),
  });

  await logUsageEvent({
    companyId,
    userId: pickString(input.mission.created_by),
    applicationId,
    eventType: "pipeline_generation",
    provider: "openai",
    metadata: {
      generated_via: "public_apply",
      pipeline_id: pickString(generated?.pipeline?.id),
    },
  });

  if (!generated?.pipeline || generated.questions.length === 0) {
    throw new Error("Application questions are not available yet");
  }

  return generated;
}

async function findCandidateByIdentity(input: {
  supabase: SupabaseServiceClient;
  companyId: string;
  email: string;
  linkedinUrl: string;
}) {
  const { data: emailCandidate, error: emailError } = await input.supabase
    .from("candidates")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("email", input.email)
    .maybeSingle();

  if (emailError) throw new Error(emailError.message || "Unable to load candidate");
  if (emailCandidate) return asObject(emailCandidate);

  const { data: linkedCandidate, error: linkedError } = await input.supabase
    .from("candidates")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("linkedin_url", input.linkedinUrl)
    .maybeSingle();

  if (linkedError) throw new Error(linkedError.message || "Unable to load candidate");
  if (linkedCandidate) return asObject(linkedCandidate);

  const normalizedLinkedin = normalizeUrl(input.linkedinUrl);
  if (!normalizedLinkedin) return null;

  const { data: candidates, error: candidateError } = await input.supabase
    .from("candidates")
    .select("*")
    .eq("company_id", input.companyId)
    .not("linkedin_url", "is", null)
    .limit(1000);

  if (candidateError) throw new Error(candidateError.message || "Unable to load candidate");

  return (Array.isArray(candidates) ? candidates : [])
    .map(asObject)
    .find((candidate) => normalizeUrl(pickString(candidate.linkedin_url)) === normalizedLinkedin) ?? null;
}

async function getOrCreatePublicCandidate(input: {
  supabase: SupabaseServiceClient;
  companyId: string;
  applicationId: string;
  email: string;
  linkedinUrl: string;
}) {
  const existing = await findCandidateByIdentity(input);
  if (existing) {
    const updates: Record<string, unknown> = {};
    if (!pickString(existing.email)) updates.email = input.email;
    if (!pickString(existing.linkedin_url)) updates.linkedin_url = input.linkedinUrl;

    if (Object.keys(updates).length > 0) {
      await input.supabase
        .from("candidates")
        .update(updates)
        .eq("id", existing.id)
        .eq("company_id", input.companyId);
    }

    return {
      ...existing,
      ...updates,
    };
  }

  const { data, error } = await input.supabase
    .from("candidates")
    .insert({
      company_id: input.companyId,
      email: input.email,
      linkedin_url: input.linkedinUrl,
      source: "application",
      status: "screening",
      consent_given: true,
      consent_at: new Date().toISOString(),
      metadata: {
        created_via: "public_mission_apply",
        first_application_id: input.applicationId,
      },
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Unable to create candidate");
  return asObject(data);
}

async function findReusableSession(input: {
  supabase: SupabaseServiceClient;
  candidateId: string;
  pipelineId: string;
}) {
  const { data, error } = await input.supabase
    .from("pipeline_sessions")
    .select("*")
    .eq("candidate_id", input.candidateId)
    .eq("pipeline_id", input.pipelineId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load application session");
  if (!data) return null;

  const session = asObject(data);
  const status = pickString(session.status) ?? "not_started";
  const expiresAt = pickString(session.expires_at);
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return null;
  return REUSABLE_SESSION_STATUSES.has(status) ? session : null;
}

export async function getPublicMissionApplyPage(missionSlug: string) {
  const supabase = createSupabaseServiceClient();
  const mission = await getEnabledMissionBySlug(supabase, missionSlug);
  if (!mission) return null;

  const companyId = pickString(mission.company_id);
  if (!companyId) return null;

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) throw new Error(companyError.message || "Unable to load company");

  return {
    mission,
    company: asObject(company),
  };
}

export async function createPublicMissionApplicationSession(input: {
  missionSlug: string;
  email: string;
  linkedinUrl: string;
}) {
  const email = normalizeEmail(input.email);
  const linkedinUrl = pickString(input.linkedinUrl);
  if (!email) throw new Error("A valid email is required");
  if (!linkedinUrl) throw new Error("LinkedIn URL is required");

  const supabase = createSupabaseServiceClient();
  const mission = await getEnabledMissionBySlug(supabase, input.missionSlug);
  if (!mission) throw new Error("Application link not found");

  const companyId = pickString(mission.company_id);
  const applicationId = pickString(mission.id);
  if (!companyId || !applicationId) throw new Error("Invalid application");

  const pipeline = await ensureMissionPipeline({ supabase, mission });
  const pipelineId = pickString(pipeline.pipeline?.id);
  if (!pipelineId) throw new Error("Application pipeline is not available");

  const candidate = await getOrCreatePublicCandidate({
    supabase,
    companyId,
    applicationId,
    email,
    linkedinUrl,
  });
  const candidateId = pickString(candidate.id);
  if (!candidateId) throw new Error("Unable to create candidate");

  const existingSession = await findReusableSession({ supabase, candidateId, pipelineId });
  let session = existingSession;
  if (!session) {
    await assertUsageLimit({
      companyId,
      applicationId,
      eventType: "pipeline_session_created",
    });

    session = await createPipelineSession({
      companyId,
      candidateId,
      pipelineId,
      applicationId,
      candidateEmail: email,
      candidateName: null,
      metadata: {
        created_via: "public_mission_apply",
        public_slug: pickString(mission.public_slug),
        pipeline_generation_mode: pickString(mission.pipeline_generation_mode) ?? "dynamic",
      },
    });
  }

  await upsertCandidateMission({
    companyId,
    candidateId,
    applicationId,
    sourceType: "application",
    status: "screening",
    metadata: {
      application_session_id: session.id,
      application_pipeline_id: pipelineId,
      applied_via: "public_mission_apply",
      public_slug: pickString(mission.public_slug),
    },
  });

  if (!existingSession) {
    await logUsageEvent({
      companyId,
      applicationId,
      candidateId,
      eventType: "pipeline_session_created",
      metadata: {
        pipeline_id: pipelineId,
        pipeline_session_id: session.id,
        created_via: "public_mission_apply",
      },
    });
  }

  const token = String(session.public_token);
  const status = pickString(session.status);
  const started = COMPLETED_SESSION_STATUSES.has(status ?? "")
    ? await getPipelineSessionByToken(token)
    : await identifyAndStartPipelineSession(token, {
        email,
        linkedinUrl,
      });

  if (!started) throw new Error("Application session not found");

  return {
    ...started,
    token,
    url: `/apply/session/${session.public_token}`,
    legacyUrl: `/apply/${session.public_token}`,
  };
}
