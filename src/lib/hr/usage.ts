import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { asObject } from "./utils";

export type HrUsageEventType =
  | "ai_score"
  | "linkedin_verification"
  | "document_parse"
  | "pipeline_submit"
  | "pipeline_generation"
  | "pipeline_session_created"
  | "pipeline_response_analysis"
  | "candidate_import"
  | "candidate_export"
  | "mission_create"
  | "manual"
  | "other";

type UsageLimitKey =
  | "max_missions"
  | "max_candidates"
  | "max_linkedin_verifications"
  | "max_document_parses"
  | "max_pipeline_generations"
  | "max_pipeline_sessions"
  | "max_pipeline_response_analyses"
  | "max_pipeline_responses";

type UsageLimitRow = Partial<Record<UsageLimitKey, number>> & {
  reset_at?: string | null;
};

const DEFAULT_LIMITS: Record<UsageLimitKey, number> = {
  max_missions: 1000,
  max_candidates: 5000,
  max_linkedin_verifications: 500,
  max_document_parses: 500,
  max_pipeline_generations: 50,
  max_pipeline_sessions: 500,
  max_pipeline_response_analyses: 500,
  max_pipeline_responses: 1000,
};

const EVENT_LIMITS: Partial<Record<HrUsageEventType, UsageLimitKey>> = {
  mission_create: "max_missions",
  candidate_import: "max_candidates",
  ai_score: "max_candidates",
  linkedin_verification: "max_linkedin_verifications",
  document_parse: "max_document_parses",
  pipeline_generation: "max_pipeline_generations",
  pipeline_session_created: "max_pipeline_sessions",
  pipeline_response_analysis: "max_pipeline_response_analyses",
  pipeline_submit: "max_pipeline_responses",
};

type UsageCountInput = {
  companyId: string;
  eventType: HrUsageEventType;
  applicationId?: string | null;
  candidateId?: string | null;
};

async function countRows(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  table: string,
  companyId: string,
  filters: Record<string, string | null> = {},
) {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  for (const [key, value] of Object.entries(filters)) {
    if (value === null) {
      query = query.is(key, null);
    } else {
      query = query.eq(key, value);
    }
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message || `Unable to count ${table}`);
  return count ?? 0;
}

async function countUsage(input: UsageCountInput) {
  const supabase = createSupabaseServiceClient();

  if (input.eventType === "mission_create") {
    return countRows(supabase, "missions", input.companyId);
  }

  if (input.eventType === "candidate_import") {
    return countRows(supabase, "candidates", input.companyId);
  }

  if (input.eventType === "linkedin_verification") {
    return countRows(supabase, "linkedin_verifications", input.companyId);
  }

  if (input.eventType === "pipeline_generation") {
    return countRows(supabase, "pipelines", input.companyId, input.applicationId ? { mission_id: input.applicationId } : {});
  }

  if (input.eventType === "pipeline_session_created") {
    return countRows(supabase, "pipeline_sessions", input.companyId);
  }

  if (input.eventType === "pipeline_response_analysis") {
    return countRows(supabase, "pipeline_scores", input.companyId);
  }

  if (input.eventType === "pipeline_submit") {
    return countRows(supabase, "candidate_pipeline_responses", input.companyId);
  }

  const filters: Record<string, string | null> = { event_type: input.eventType };
  if (input.applicationId) filters.mission_id = input.applicationId;
  if (input.candidateId) filters.candidate_id = input.candidateId;

  return countRows(supabase, "usage_logs", input.companyId, filters);
}

async function getLimits(companyId: string): Promise<UsageLimitRow> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("company_usage_limits")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load usage limits");
  const row = asObject(data) as UsageLimitRow;
  const limits = { ...DEFAULT_LIMITS, ...row } as UsageLimitRow;

  return {
    ...limits,
    max_missions: Math.max(limits.max_missions ?? 0, DEFAULT_LIMITS.max_missions),
    max_candidates: Math.max(limits.max_candidates ?? 0, DEFAULT_LIMITS.max_candidates),
  };
}

export async function checkUsageLimit(input: UsageCountInput) {
  const limitKey = EVENT_LIMITS[input.eventType];
  if (!limitKey) {
    return {
      allowed: true,
      eventType: input.eventType,
      limitKey: null,
      limit: null,
      used: 0,
      remaining: null,
    };
  }

  const [limits, used] = await Promise.all([getLimits(input.companyId), countUsage(input)]);
  const limit = typeof limits[limitKey] === "number" ? limits[limitKey] : DEFAULT_LIMITS[limitKey];
  const remaining = Math.max(0, limit - used);

  return {
    allowed: used < limit,
    eventType: input.eventType,
    limitKey,
    limit,
    used,
    remaining,
  };
}

export async function assertUsageLimit(input: UsageCountInput) {
  const result = await checkUsageLimit(input);
  if (!result.allowed) {
    throw new Error(`Usage limit reached for ${result.limitKey}`);
  }

  return result;
}

export async function logUsageEvent(input: {
  companyId: string;
  userId?: string | null;
  applicationId?: string | null;
  candidateId?: string | null;
  eventType: HrUsageEventType;
  creditsDelta?: number;
  provider?: string | null;
  modelName?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("usage_logs").insert({
    company_id: input.companyId,
    user_id: input.userId ?? null,
    mission_id: input.applicationId ?? null,
    candidate_id: input.candidateId ?? null,
    event_type: input.eventType,
    credits_delta: input.creditsDelta ?? 0,
    provider: input.provider ?? null,
    model_name: input.modelName ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message || "Unable to log usage");
  }
}
