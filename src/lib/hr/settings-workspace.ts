import { cache } from "react";
import { getHrContext } from "@/lib/hr/auth";
import { getMonthlyUsageSummary } from "@/lib/hr/usage";
import { asObject, formatDate, pickNumber, pickString, relativeTime } from "@/lib/hr/utils";

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function numberSetting(settings: Row, key: string, fallback: number) {
  return pickNumber(settings[key]) ?? fallback;
}

function booleanSetting(settings: Row, key: string, fallback: boolean) {
  return typeof settings[key] === "boolean" ? Boolean(settings[key]) : fallback;
}

function roleLabel(role: unknown) {
  const value = pickString(role) ?? "member";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function usageLabel(eventType: unknown) {
  return (pickString(eventType) ?? "other").replaceAll("_", " ");
}

export const revalidate = 0;

export const getSettingsWorkspaceData = cache(async () => {
  const { supabase, companyId, role, user: contextUser } = await getHrContext();

  const [
    companyResponse,
    userResponse,
    missionResponse,
    candidateResponse,
    usageResponse,
    creditResponse,
    limitResponse,
    linkedinAccountResponse,
    planResponse,
    monthlyUsage,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("*, metadata")
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, email, first_name, last_name, avatar_url, role, status, last_seen_at, created_at, metadata")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    supabase
      .from("missions")
      .select("id, title, status, metadata, updated_at, created_at")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("candidates")
      .select("id, status, created_at")
      .eq("company_id", companyId),
    supabase
      .from("usage_logs")
      .select("id, event_type, credits_delta, provider, model_name, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("credits")
      .select("id, transaction_type, amount, balance_after, description, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("company_usage_limits")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase
      .from("linkedin_accounts")
      .select("id, email, status, updated_at")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("plans")
      .select("*")
      .eq("id", pickString(( await supabase.from("companies").select("plan_id").eq("id", companyId).maybeSingle() ).data?.plan_id) ?? "__none__")
      .maybeSingle(),
    getMonthlyUsageSummary(companyId),
  ]);

  for (const response of [
    companyResponse,
    userResponse,
    missionResponse,
    candidateResponse,
    usageResponse,
    creditResponse,
    limitResponse,
  ]) {
    if (response.error) throw new Error(response.error.message || "Unable to load settings");
  }

  const currentUser = contextUser;
  const users = rows(userResponse.data);

  const company = asObject(companyResponse.data);
  const settings = asObject(company.settings);
  const metadata = asObject(company.metadata);
  
  const missions = rows(missionResponse.data);
  const candidates = rows(candidateResponse.data);
  const usageLogs = rows(usageResponse.data);
  const credits = rows(creditResponse.data);
  const limits = asObject(limitResponse.data);
  const linkedinAccounts = linkedinAccountResponse.error ? [] : rows(linkedinAccountResponse.data);
  const plan = planResponse.error ? null : asObject(planResponse.data);
  const activeMissions = missions.filter((mission) => pickString(mission.status) === "open").length;
  const archivedMissions = missions.filter((mission) => {
    const status = pickString(mission.status);
    return status === "archived" || status === "closed";
  }).length;
  const totalCreditsSpent = usageLogs.reduce((total, log) => total + Math.abs(pickNumber(log.credits_delta) ?? 0), 0);
  const usageByEvent = new Map<string, { count: number; credits: number; last: string }>();

  for (const log of usageLogs) {
    const key = pickString(log.event_type) ?? "other";
    const current = usageByEvent.get(key) ?? { count: 0, credits: 0, last: "" };
    current.count += 1;
    current.credits += Math.abs(pickNumber(log.credits_delta) ?? 0);
    current.last ||= pickString(log.created_at) ?? "";
    usageByEvent.set(key, current);
  }

  const missionCriteria = missions.map((mission) => {
    const metadata = asObject(mission.metadata);
    return {
      id: pickString(mission.id) ?? "",
      title: pickString(mission.title) ?? "Mission",
      mustHave: stringArray(metadata.must_have_skills),
      niceToHave: stringArray(metadata.nice_to_have_skills),
      seniority: pickString(metadata.seniority) ?? "-",
      difficulty: pickString(metadata.difficulty_level) ?? "-",
      fitThreshold: pickNumber(metadata.fit_threshold),
      trustThreshold: pickNumber(metadata.trust_threshold),
      updatedAt: relativeTime(mission.updated_at ?? mission.created_at),
    };
  });
  const mustHaveSkills = unique(missionCriteria.flatMap((mission) => mission.mustHave));
  const niceToHaveSkills = unique(missionCriteria.flatMap((mission) => mission.niceToHave));

  return {
    role,
    company: {
      id: companyId,
      name: pickString(company.name) ?? "Company",
      slug: pickString(company.slug) ?? "-",
      legalName: pickString(company.legal_name) ?? "-",
      websiteUrl: pickString(company.website_url) ?? "-",
      linkedinUrl: pickString(company.linkedin_url) ?? "-",
      industry: pickString(company.industry) ?? "-",
      sizeRange: pickString(company.size_range) ?? "-",
      country: pickString(company.country) ?? "-",
      timezone: pickString(company.timezone) ?? "Europe/Paris",
      locale: pickString(company.locale) ?? "fr",
      billingEmail: pickString(company.billing_email) ?? "-",
      plan: pickString(company.plan) ?? "free",
      planId: pickString(company.plan_id) ?? null,
      planLabel: plan ? pickString(plan.label) ?? "Free" : "Free",
      planDescription: plan ? pickString(plan.description) ?? null : null,
      status: pickString(company.status) ?? "active",
      creditsBalance: pickNumber(company.credits_balance) ?? 0,
      createdAt: formatDate(company.created_at),
      openaiConfigured: Boolean(pickString(settings.openai_api_key)),
    },
    team: {
      total: users.length,
      admins: users.filter((user) => {
        const userRole = pickString(user.role);
        return userRole === "owner" || userRole === "admin";
      }).length,
      recruiters: users.filter((user) => pickString(user.role) === "recruiter").length,
      reviewers: users.filter((user) => pickString(user.role) === "reviewer").length,
      members: users.map((user) => ({
        id: pickString(user.id) ?? "",
        name: [pickString(user.first_name), pickString(user.last_name)].filter(Boolean).join(" ") || pickString(user.email) || "Member",
        email: pickString(user.email) ?? "-",
        role: roleLabel(user.role),
        status: pickString(user.status) ?? "active",
        lastSeen: pickString(user.last_seen_at) ? relativeTime(user.last_seen_at) : "Never",
        joinedAt: formatDate(user.created_at),
      })),
    },
    usage: {
      totalCreditsSpent,
      recent: usageLogs.slice(0, 8).map((log) => ({
        id: pickString(log.id) ?? "",
        event: usageLabel(log.event_type),
        credits: pickNumber(log.credits_delta) ?? 0,
        provider: pickString(log.provider) ?? "-",
        model: pickString(log.model_name) ?? "-",
        createdAt: relativeTime(log.created_at),
      })),
      byEvent: [...usageByEvent.entries()].map(([event, item]) => ({
        event: usageLabel(event),
        count: item.count,
        credits: item.credits,
        last: relativeTime(item.last),
      })),
      limits: {
        maxMissions: pickNumber(limits.max_missions) ?? 1,
        maxCandidates: Math.max(pickNumber(limits.max_candidates) ?? 0, 5000),
        maxLinkedinVerifications: pickNumber(limits.max_linkedin_verifications) ?? 50,
        maxDocumentParses: pickNumber(limits.max_document_parses) ?? 50,
        maxPipelineGenerations: pickNumber(limits.max_pipeline_generations) ?? 2,
        maxPipelineSessions: pickNumber(limits.max_pipeline_sessions) ?? 50,
        maxPipelineResponseAnalyses: pickNumber(limits.max_pipeline_response_analyses) ?? 50,
        maxPipelineResponses: pickNumber(limits.max_pipeline_responses) ?? 100,
        // New plan-based limits
        maxRecruiterSeats: pickNumber(limits.max_recruiter_seats) ?? 1,
        maxSourcingFlows: pickNumber(limits.max_sourcing_flows) ?? 2,
        maxApplicationFlows: pickNumber(limits.max_application_flows) ?? 2,
        maxSourcingProfiles: pickNumber(limits.max_sourcing_profiles) ?? 50,
        maxSourcingAnalyses: pickNumber(limits.max_sourcing_analyses) ?? 50,
        maxCompanyResearches: pickNumber(limits.max_company_researches) ?? 20,
        maxApplications: pickNumber(limits.max_applications) ?? 75,
        maxCvParses: pickNumber(limits.max_cv_parses) ?? 75,
        maxApplicationAnalyses: pickNumber(limits.max_application_analyses) ?? 75,
        maxMonthlyCredits: pickNumber(limits.max_monthly_credits) ?? 200,
        periodStart: pickString(limits.current_period_start) ? formatDate(limits.current_period_start) : "-",
        periodEnd: pickString(limits.current_period_end) ? formatDate(limits.current_period_end) : "-",
        resetAt: pickString(limits.reset_at) ? formatDate(limits.reset_at) : "-",
      },
      monthly: {
        summary: monthlyUsage.summary,
        totalCredits: monthlyUsage.totalCredits,
        periodStart: monthlyUsage.periodStart,
      },
      credits: credits.map((credit) => ({
        id: pickString(credit.id) ?? "",
        type: usageLabel(credit.transaction_type),
        amount: pickNumber(credit.amount) ?? 0,
        balanceAfter: pickNumber(credit.balance_after) ?? 0,
        description: pickString(credit.description) ?? "-",
        createdAt: formatDate(credit.created_at),
      })),
    },
    criteria: {
      fitThreshold: numberSetting(settings, "fit_threshold", 80),
      trustThreshold: numberSetting(settings, "trust_threshold", 75),
      requireLinkedin: booleanSetting(settings, "use_linkedin_verification", true),
      requireCvCoherence: booleanSetting(settings, "require_cv_coherence", true),
      candidateLinksEnabled: booleanSetting(settings, "candidate_link_enabled", true),
      mustHaveSkills,
      niceToHaveSkills,
      recentMissions: missionCriteria.slice(0, 6),
    },
    workspace: {
      missions: missions.length,
      applications: missions.length,
      activeMissions,
      archivedMissions,
      candidates: candidates.length,
    },
    linkedin: {
      accountName: pickString(asObject(company.metadata).linkedin_account_name),
      accountImage: pickString(asObject(company.metadata).linkedin_account_image),
      lastSyncedAt: pickString(asObject(company.metadata).linkedin_cookie_updated_at),
      lastDetectedIp: pickString(linkedinAccounts[0]?.last_detected_ip),
      lastDetectedCountry: pickString(linkedinAccounts[0]?.last_detected_country),
      lastDetectedCity: pickString(linkedinAccounts[0]?.last_detected_city),
      accounts: linkedinAccounts.map(acc => ({
        id: pickString(acc.id),
        email: pickString(acc.email),
        status: pickString(acc.status),
        updatedAt: relativeTime(acc.updated_at)
      }))
    },
    user: {
      id: pickString(currentUser?.id),
      email: pickString(currentUser?.email),
      firstName: pickString(currentUser?.first_name),
      lastName: pickString(currentUser?.last_name),
      avatarUrl: pickString(currentUser?.avatar_url),
      name: [pickString(currentUser?.first_name), pickString(currentUser?.last_name)].filter(Boolean).join(" ") || pickString(currentUser?.email) || "Profile",
    },
  };
});
