/**
 * Billing & Usage Module
 *
 * Central credit enforcement and usage tracking for VerytisHR.
 * Every billable action MUST go through this module to:
 *   1. Check quota/credit availability
 *   2. Log the usage event
 *   3. Deduct credits from the company balance
 *
 * Credit costs per action:
 *
 * SOURCING FLOW:
 *   - Import profil               → 0
 *   - Analyse sourcing profil     → 1
 *   - Vérification LinkedIn       → 1
 *   - Recherche société (Tavily)  → 1
 *   - Ré-analyse profil           → 1
 *
 * APPLICATION FLOW:
 *   - Parsing CV                  → 1
 *   - Génération pipeline         → 3
 *   - Analyse réponses pipeline   → 2
 *   - Analyse application         → 1
 */

import { createSupabaseServiceClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Credit costs
// ---------------------------------------------------------------------------

export const CREDIT_COSTS = {
  // ── Sourcing flow ──
  candidate_import: 0,
  sourcing_profile_analyzed: 1,
  linkedin_profile_verified: 1,
  company_research_used: 1,

  // ── Application flow ──
  cv_parsed: 1,
  pipeline_generated: 3,
  pipeline_response_analyzed: 2,
  application_analyzed: 1,

  // Free actions (logged but 0 credits)
  pipeline_session_created: 0,
  pipeline_submit: 0,
  mission_create: 0,
} as const;

export type BillableEvent = keyof typeof CREDIT_COSTS;

// ---------------------------------------------------------------------------
// Quota keys mapped to event types
// ---------------------------------------------------------------------------

const QUOTA_MAP: Record<string, string> = {
  cv_parsed: "max_cv_parses",
  linkedin_verified: "max_linkedin_verifications",
  application_analyzed: "max_application_analyses",
  pipeline_generated: "max_pipeline_generations",
  sourcing_profile_analyzed: "max_sourcing_analyses",
  company_research_used: "max_company_researches",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UsageContext = {
  companyId: string;
  userId?: string | null;
  missionId?: string | null;
  candidateId?: string | null;
};

export type QuotaStatus = {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  creditsRemaining: number;
};

export class QuotaExceededError extends Error {
  status = 402;
  quotaStatus: QuotaStatus;

  constructor(message: string, quotaStatus: QuotaStatus) {
    super(message);
    this.quotaStatus = quotaStatus;
  }
}

// ---------------------------------------------------------------------------
// Core: check quota for an event
// ---------------------------------------------------------------------------

export async function checkQuota(
  ctx: UsageContext,
  eventType: BillableEvent,
): Promise<QuotaStatus> {
  const supabase = createSupabaseServiceClient();
  const creditCost = CREDIT_COSTS[eventType] ?? 0;

  // 1. Load company limits
  const { data: limits } = await supabase
    .from("company_usage_limits")
    .select("*")
    .eq("company_id", ctx.companyId)
    .maybeSingle();

  // 2. Load company credits balance
  const { data: company } = await supabase
    .from("companies")
    .select("credits_balance, plan, plan_id")
    .eq("id", ctx.companyId)
    .maybeSingle();

  const creditsBalance = company?.credits_balance ?? 0;

  // If no limits row exists, allow (early stage / no plan)
  if (!limits) {
    return {
      allowed: true,
      current: 0,
      limit: Infinity,
      creditsRemaining: creditsBalance,
    };
  }

  // 3. Check per-action quota (monthly)
  const quotaColumn = QUOTA_MAP[eventType];
  if (quotaColumn) {
    const maxAllowed = (limits as Record<string, unknown>)[quotaColumn];
    if (typeof maxAllowed === "number" && maxAllowed > 0) {
      const periodStart = limits.current_period_start
        ? new Date(limits.current_period_start as string).toISOString()
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const { count } = await supabase
        .from("usage_events")
        .select("id", { count: "exact", head: true })
        .eq("company_id", ctx.companyId)
        .eq("event_type", eventType)
        .gte("created_at", periodStart);

      const currentCount = count ?? 0;

      if (currentCount >= maxAllowed) {
        return {
          allowed: false,
          reason: `Monthly quota exceeded for ${eventType}: ${currentCount}/${maxAllowed}`,
          current: currentCount,
          limit: maxAllowed,
          creditsRemaining: creditsBalance,
        };
      }

      // 4. Check monthly credit cap
      if (creditCost > 0) {
        const maxMonthlyCredits = (limits as Record<string, unknown>).max_monthly_credits;
        if (typeof maxMonthlyCredits === "number" && maxMonthlyCredits > 0) {
          const { data: monthEvents } = await supabase
            .from("usage_events")
            .select("credits_used")
            .eq("company_id", ctx.companyId)
            .gte("created_at", periodStart);

          const usedThisMonth = (monthEvents ?? []).reduce(
            (sum: number, e: Record<string, unknown>) => sum + ((e.credits_used as number) ?? 0),
            0,
          );

          if (usedThisMonth + creditCost > maxMonthlyCredits) {
            return {
              allowed: false,
              reason: `Monthly credit limit reached: ${usedThisMonth}/${maxMonthlyCredits}`,
              current: usedThisMonth,
              limit: maxMonthlyCredits,
              creditsRemaining: creditsBalance,
            };
          }
        }
      }

      return {
        allowed: true,
        current: currentCount,
        limit: maxAllowed,
        creditsRemaining: creditsBalance,
      };
    }
  }

  // No specific quota configured — allow
  return {
    allowed: true,
    current: 0,
    limit: Infinity,
    creditsRemaining: creditsBalance,
  };
}

// ---------------------------------------------------------------------------
// Core: record a usage event and deduct credits
// ---------------------------------------------------------------------------

export async function recordUsage(
  ctx: UsageContext,
  eventType: BillableEvent,
  metadata?: Record<string, unknown>,
): Promise<{ eventId: string; creditsUsed: number }> {
  const supabase = createSupabaseServiceClient();
  const creditsUsed = CREDIT_COSTS[eventType] ?? 0;

  // 1. Insert usage event
  const { data: event, error: eventError } = await supabase
    .from("usage_events")
    .insert({
      company_id: ctx.companyId,
      user_id: ctx.userId ?? null,
      event_type: eventType,
      credits_used: creditsUsed,
      mission_id: ctx.missionId ?? null,
      candidate_id: ctx.candidateId ?? null,
      metadata: metadata ?? {},
    })
    .select("id")
    .single();

  if (eventError) {
    console.error(`[Billing] Failed to record usage event: ${eventError.message}`);
    throw new Error(`Failed to record usage: ${eventError.message}`);
  }

  // 2. Also write to legacy usage_logs for backwards compat
  await supabase.from("usage_logs").insert({
    company_id: ctx.companyId,
    user_id: ctx.userId ?? null,
    mission_id: ctx.missionId ?? null,
    candidate_id: ctx.candidateId ?? null,
    event_type: eventType,
    credits_delta: -creditsUsed,
    metadata: metadata ?? {},
  });

  // 3. Deduct credits from company balance (if applicable)
  if (creditsUsed > 0) {
    const { data: company } = await supabase
      .from("companies")
      .select("credits_balance")
      .eq("id", ctx.companyId)
      .single();

    const currentBalance = company?.credits_balance ?? 0;
    const newBalance = Math.max(0, currentBalance - creditsUsed);

    await supabase
      .from("companies")
      .update({ credits_balance: newBalance })
      .eq("id", ctx.companyId);

    // 4. Record credit transaction
    await supabase.from("credits").insert({
      company_id: ctx.companyId,
      transaction_type: "usage",
      amount: -creditsUsed,
      balance_after: newBalance,
      usage_log_id: event.id,
      description: `${eventType} credit deduction`,
    });
  }

  return { eventId: event.id, creditsUsed };
}

// ---------------------------------------------------------------------------
// Convenience: check + record in one call (throws on quota exceeded)
// ---------------------------------------------------------------------------

export async function enforceAndRecord(
  ctx: UsageContext,
  eventType: BillableEvent,
  metadata?: Record<string, unknown>,
): Promise<{ eventId: string; creditsUsed: number }> {
  const status = await checkQuota(ctx, eventType);
  if (!status.allowed) {
    throw new QuotaExceededError(
      status.reason || `Quota exceeded for ${eventType}`,
      status,
    );
  }
  return recordUsage(ctx, eventType, metadata);
}

// ---------------------------------------------------------------------------
// Flow-level quotas: check sourcing/application flow counts
// ---------------------------------------------------------------------------

export async function checkFlowQuota(
  companyId: string,
  flowType: "sourcing" | "application",
): Promise<QuotaStatus> {
  const supabase = createSupabaseServiceClient();

  const { data: limits } = await supabase
    .from("company_usage_limits")
    .select("max_sourcing_flows, max_application_flows")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!limits) {
    return { allowed: true, current: 0, limit: Infinity, creditsRemaining: 0 };
  }

  const maxFlows = flowType === "sourcing"
    ? (limits as Record<string, unknown>).max_sourcing_flows as number ?? 999
    : (limits as Record<string, unknown>).max_application_flows as number ?? 999;

  // Count active missions of this type
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
      reason: `Maximum ${flowType} flows reached: ${activeMissions.length}/${maxFlows}`,
      current: activeMissions.length,
      limit: maxFlows,
      creditsRemaining: 0,
    };
  }

  return {
    allowed: true,
    current: activeMissions.length,
    limit: maxFlows,
    creditsRemaining: 0,
  };
}

// ---------------------------------------------------------------------------
// Seat quota check
// ---------------------------------------------------------------------------

export async function checkSeatQuota(companyId: string): Promise<QuotaStatus> {
  const supabase = createSupabaseServiceClient();

  const { data: limits } = await supabase
    .from("company_usage_limits")
    .select("max_recruiter_seats")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!limits) {
    return { allowed: true, current: 0, limit: Infinity, creditsRemaining: 0 };
  }

  const maxSeats = (limits as Record<string, unknown>).max_recruiter_seats as number ?? 999;

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
      reason: `Maximum recruiter seats reached: ${current}/${maxSeats}`,
      current,
      limit: maxSeats,
      creditsRemaining: 0,
    };
  }

  return { allowed: true, current, limit: maxSeats, creditsRemaining: 0 };
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
