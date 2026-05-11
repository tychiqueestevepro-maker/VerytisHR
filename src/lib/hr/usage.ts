/**
 * Usage Module – Quota enforcement & credit tracking
 *
 * This module is the single entry-point for all API routes that need to:
 *   1. Check whether a company has remaining quota for an action
 *   2. Log usage events (both legacy `usage_logs` and new `usage_events`)
 *   3. Deduct credits from the company balance
 *
 * ── Credit costs ──────────────────────────────────────
 *
 * APPLICATION FLOW:
 *   Création apply link         → 0
 *   Candidature reçue           → 0
 *   Parsing CV                  → 1
 *   Vérification LinkedIn / CV  → 1
 *   Analyse réponses pipeline   → 2
 *   Génération pipeline         → 1
 *
 * SOURCING FLOW:
 *   Import profil               → 0
 *   Analyse sourcing profil     → 1
 *   Vérification LinkedIn       → 1
 *   Recherche société (Tavily)  → 1
 *   Ré-analyse profil           → 1
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { asObject } from "./utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  // New granular event types
  | "sourcing_profile_analyzed"
  | "linkedin_verified"
  | "linkedin_profile_verified"
  | "company_research_used"
  | "cv_parsed"
  | "pipeline_generated"
  | "pipeline_response_analyzed"
  | "application_analyzed"
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
  | "max_pipeline_responses"
  // New plan-based limit keys
  | "max_recruiter_seats"
  | "max_sourcing_flows"
  | "max_application_flows"
  | "max_sourcing_profiles"
  | "max_sourcing_analyses"
  | "max_company_researches"
  | "max_applications"
  | "max_cv_parses"
  | "max_application_analyses"
  | "max_monthly_credits";

type UsageLimitRow = Partial<Record<UsageLimitKey, number>> & {
  reset_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
};

// ---------------------------------------------------------------------------
// Credit cost per event type
// ---------------------------------------------------------------------------

const CREDIT_COSTS: Record<string, number> = {
  // ── Sourcing flow ──
  candidate_import: 0,
  sourcing_profile_analyzed: 1,
  linkedin_profile_verified: 1,
  linkedin_verification: 1,          // legacy alias
  linkedin_verified: 1,              // legacy alias
  company_research_used: 1,

  // ── Application flow ──
  cv_parsed: 1,
  document_parse: 1,                 // legacy alias
  pipeline_generated: 3,
  pipeline_generation: 3,            // legacy alias
  pipeline_response_analyzed: 2,
  pipeline_response_analysis: 2,     // legacy alias
  application_analyzed: 1,
  ai_score: 1,                       // legacy alias

  // ── Free actions ──
  pipeline_submit: 0,
  pipeline_session_created: 0,
  mission_create: 0,
  candidate_export: 0,
  manual: 0,
  other: 0,
};

// ---------------------------------------------------------------------------
// Default limits (generous for companies without a plan)
// ---------------------------------------------------------------------------

const DEFAULT_LIMITS: Record<UsageLimitKey, number> = {
  max_missions: 1000,
  max_candidates: 5000,
  max_linkedin_verifications: 500,
  max_document_parses: 500,
  max_pipeline_generations: 50,
  max_pipeline_sessions: 500,
  max_pipeline_response_analyses: 500,
  max_pipeline_responses: 1000,
  // New defaults
  max_recruiter_seats: 999,
  max_sourcing_flows: 999,
  max_application_flows: 999,
  max_sourcing_profiles: 999,
  max_sourcing_analyses: 999,
  max_company_researches: 999,
  max_applications: 999,
  max_cv_parses: 999,
  max_application_analyses: 999,
  max_monthly_credits: 99999,
};

// ---------------------------------------------------------------------------
// Event → quota column mapping
// ---------------------------------------------------------------------------

const EVENT_LIMITS: Partial<Record<HrUsageEventType, UsageLimitKey>> = {
  mission_create: "max_missions",
  candidate_import: "max_candidates",
  ai_score: "max_application_analyses",
  application_analyzed: "max_application_analyses",
  linkedin_verification: "max_linkedin_verifications",
  linkedin_verified: "max_linkedin_verifications",
  linkedin_profile_verified: "max_linkedin_verifications",
  document_parse: "max_cv_parses",
  cv_parsed: "max_cv_parses",
  pipeline_generation: "max_pipeline_generations",
  pipeline_generated: "max_pipeline_generations",
  pipeline_session_created: "max_pipeline_sessions",
  pipeline_response_analysis: "max_pipeline_response_analyses",
  pipeline_response_analyzed: "max_pipeline_response_analyses",
  pipeline_submit: "max_pipeline_responses",
  sourcing_profile_analyzed: "max_sourcing_analyses",
  company_research_used: "max_company_researches",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * For monthly-quota event types, count usage_events this billing period.
 * For legacy event types, fall back to table-level counts.
 */
async function countUsage(input: UsageCountInput, periodStart?: string) {
  const supabase = createSupabaseServiceClient();

  // Monthly event-based counting (new system)
  const isMonthlyEvent = [
    "sourcing_profile_analyzed",
    "linkedin_verified",
    "company_research_used",
    "cv_parsed",
    "application_analyzed",
  ].includes(input.eventType);

  if (isMonthlyEvent && periodStart) {
    const { count } = await supabase
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", input.companyId)
      .eq("event_type", input.eventType)
      .gte("created_at", periodStart);
    return count ?? 0;
  }

  // Legacy counting (backwards compat)
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

  if (input.eventType === "document_parse" || input.eventType === "ai_score") {
    // For these legacy types also count usage_events if period is available
    if (periodStart) {
      const { count } = await supabase
        .from("usage_events")
        .select("id", { count: "exact", head: true })
        .eq("company_id", input.companyId)
        .eq("event_type", input.eventType)
        .gte("created_at", periodStart);
      return count ?? 0;
    }
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

// ---------------------------------------------------------------------------
// Check quota
// ---------------------------------------------------------------------------

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
      creditCost: CREDIT_COSTS[input.eventType] ?? 0,
    };
  }

  const limits = await getLimits(input.companyId);
  const periodStart =
    limits.current_period_start ??
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [used] = await Promise.all([countUsage(input, periodStart)]);
  const limit = typeof limits[limitKey] === "number" ? limits[limitKey]! : DEFAULT_LIMITS[limitKey];
  const remaining = Math.max(0, limit - used);

  // Also check monthly credit cap
  const creditCost = CREDIT_COSTS[input.eventType] ?? 0;
  if (creditCost > 0 && typeof limits.max_monthly_credits === "number") {
    const supabase = createSupabaseServiceClient();
    const { data: monthEvents } = await supabase
      .from("usage_events")
      .select("credits_used")
      .eq("company_id", input.companyId)
      .gte("created_at", periodStart);

    const usedCredits = (monthEvents ?? []).reduce(
      (sum: number, e: Record<string, unknown>) => sum + ((asObject(e).credits_used as number) ?? 0),
      0,
    );

    if (usedCredits + creditCost > limits.max_monthly_credits!) {
      return {
        allowed: false,
        eventType: input.eventType,
        limitKey: "max_monthly_credits" as const,
        limit: limits.max_monthly_credits!,
        used: usedCredits,
        remaining: Math.max(0, limits.max_monthly_credits! - usedCredits),
        creditCost,
        reason: `Monthly credit limit reached (${usedCredits}/${limits.max_monthly_credits})`,
      };
    }
  }

  return {
    allowed: used < limit,
    eventType: input.eventType,
    limitKey,
    limit,
    used,
    remaining,
    creditCost,
  };
}

// ---------------------------------------------------------------------------
// Assert (throws on exceeded)
// ---------------------------------------------------------------------------

export async function assertUsageLimit(input: UsageCountInput) {
  const result = await checkUsageLimit(input);
  if (!result.allowed) {
    const reason =
      (result as Record<string, unknown>).reason ??
      `Usage limit reached for ${result.limitKey} (${result.used}/${result.limit})`;
    throw new Error(String(reason));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Log usage event + deduct credits
// ---------------------------------------------------------------------------

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
  const creditCost = CREDIT_COSTS[input.eventType] ?? 0;

  // 1. Write to legacy usage_logs (backwards compat)
  const { error } = await supabase.from("usage_logs").insert({
    company_id: input.companyId,
    user_id: input.userId ?? null,
    mission_id: input.applicationId ?? null,
    candidate_id: input.candidateId ?? null,
    event_type: input.eventType,
    credits_delta: input.creditsDelta ?? -creditCost,
    provider: input.provider ?? null,
    model_name: input.modelName ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error(`[Usage] Failed to log usage event: ${error.message}`);
    // Don't throw — we don't want to block the action for a logging failure
  }

  // 2. Write to new usage_events table
  try {
    await supabase.from("usage_events").insert({
      company_id: input.companyId,
      user_id: input.userId ?? null,
      event_type: input.eventType,
      credits_used: creditCost,
      mission_id: input.applicationId ?? null,
      candidate_id: input.candidateId ?? null,
      metadata: {
        ...input.metadata,
        provider: input.provider ?? null,
        model_name: input.modelName ?? null,
      },
    });
  } catch (eventError) {
    console.error("[Usage] Failed to write usage_event:", eventError);
  }

  // 3. Deduct credits from company balance
  if (creditCost > 0) {
    try {
      const { data: company } = await supabase
        .from("companies")
        .select("credits_balance")
        .eq("id", input.companyId)
        .single();

      const currentBalance = (company?.credits_balance as number) ?? 0;
      const newBalance = Math.max(0, currentBalance - creditCost);

      await supabase
        .from("companies")
        .update({ credits_balance: newBalance })
        .eq("id", input.companyId);

      // 4. Record credit transaction
      await supabase.from("credits").insert({
        company_id: input.companyId,
        transaction_type: "usage",
        amount: -creditCost,
        balance_after: newBalance,
        description: `${input.eventType} (${creditCost} credit${creditCost > 1 ? "s" : ""})`,
      });

      console.log(
        `[Billing] ${input.eventType}: -${creditCost} credit(s) | Balance: ${currentBalance} → ${newBalance}`,
      );
    } catch (creditError) {
      console.error("[Billing] Failed to deduct credits:", creditError);
    }
  }
}

// ---------------------------------------------------------------------------
// Flow quota checks (for mission creation)
// ---------------------------------------------------------------------------

export async function checkFlowQuota(
  companyId: string,
  flowType: "sourcing" | "application",
) {
  const supabase = createSupabaseServiceClient();

  const { data: limits } = await supabase
    .from("company_usage_limits")
    .select("max_sourcing_flows, max_application_flows")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!limits) {
    return { allowed: true, current: 0, limit: Infinity };
  }

  const maxFlows =
    flowType === "sourcing"
      ? ((limits as Record<string, unknown>).max_sourcing_flows as number) ?? 999
      : ((limits as Record<string, unknown>).max_application_flows as number) ?? 999;

  const { data: missions } = await supabase
    .from("missions")
    .select("id, metadata")
    .eq("company_id", companyId)
    .in("status", ["draft", "open", "paused"]);

  const activeMissions = (missions ?? []).filter((m: Record<string, unknown>) => {
    const meta = m.metadata as Record<string, unknown> | null;
    const type = (meta?.workflow_type as string) ?? "application";
    return type === flowType;
  });

  if (activeMissions.length >= maxFlows) {
    return {
      allowed: false,
      current: activeMissions.length,
      limit: maxFlows,
      reason: `Maximum ${flowType} flows reached: ${activeMissions.length}/${maxFlows}`,
    };
  }

  return { allowed: true, current: activeMissions.length, limit: maxFlows };
}

// ---------------------------------------------------------------------------
// Seat quota check
// ---------------------------------------------------------------------------

export async function checkSeatQuota(companyId: string) {
  const supabase = createSupabaseServiceClient();

  const { data: limits } = await supabase
    .from("company_usage_limits")
    .select("max_recruiter_seats")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!limits) {
    return { allowed: true, current: 0, limit: Infinity };
  }

  const maxSeats = ((limits as Record<string, unknown>).max_recruiter_seats as number) ?? 999;

  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "active")
    .in("role", ["owner", "admin", "recruiter"]);

  const current = count ?? 0;

  if (current >= maxSeats) {
    return {
      allowed: false,
      current,
      limit: maxSeats,
      reason: `Maximum recruiter seats reached: ${current}/${maxSeats}`,
    };
  }

  return { allowed: true, current, limit: maxSeats };
}

// ---------------------------------------------------------------------------
// Monthly usage summary
// ---------------------------------------------------------------------------

export async function getMonthlyUsageSummary(companyId: string) {
  const supabase = createSupabaseServiceClient();
  const periodStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();

  const { data: events } = await supabase
    .from("usage_events")
    .select("event_type, credits_used")
    .eq("company_id", companyId)
    .gte("created_at", periodStart);

  const summary: Record<string, { count: number; credits: number }> = {};
  let totalCredits = 0;

  for (const event of events ?? []) {
    const evt = event as Record<string, unknown>;
    const type = evt.event_type as string;
    const credits = (evt.credits_used as number) ?? 0;
    if (!summary[type]) summary[type] = { count: 0, credits: 0 };
    summary[type].count += 1;
    summary[type].credits += credits;
    totalCredits += credits;
  }

  return { summary, totalCredits, periodStart };
}
