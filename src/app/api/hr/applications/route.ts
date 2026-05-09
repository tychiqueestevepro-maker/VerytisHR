import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { assertUsageLimit, logUsageEvent } from "@/lib/hr/usage";
import { asObject, pickString } from "@/lib/hr/utils";

export const runtime = "nodejs";

function missionPayload(body: Record<string, unknown>, companyId: string, userId: string) {
  const salaryRange = asObject(body.salary_range);
  const metadata = {
    team_context: body.team_context ?? null,
    team_workflow: body.team_workflow ?? null,
    company_context: body.company_context ?? null,
    current_situation: body.current_situation ?? null,
    previous_team_work: body.previous_team_work ?? null,
    job_objectives: body.job_objectives ?? null,
    must_have_skills: Array.isArray(body.must_have_skills) ? body.must_have_skills : [],
    nice_to_have_skills: Array.isArray(body.nice_to_have_skills) ? body.nice_to_have_skills : [],
    seniority: body.seniority ?? null,
    hiring_goal: body.hiring_goal ?? null,
    pain_challenge: body.pain_challenge ?? null,
    manager_expectations: body.manager_expectations ?? null,
    success_criteria: body.success_criteria ?? null,
    import_list_name: body.import_list_name ?? null,
    import_source: body.import_source ?? null,
    target_profiles: body.target_profiles ?? null,
    qualification_goal: body.qualification_goal ?? null,
    priority_signals: body.priority_signals ?? null,
    disqualifiers: body.disqualifiers ?? null,
    fit_threshold: body.fit_threshold ?? null,
    trust_threshold: body.trust_threshold ?? null,
    use_linkedin_verification: body.use_linkedin_verification === true,
    require_cv_coherence: body.require_cv_coherence === true,
    generate_contextual_pipeline: body.generate_contextual_pipeline === true,
    difficulty_level: body.difficulty_level ?? null,
    candidate_link_enabled: body.candidate_link_enabled === true,
    workflow_type: body.workflow_type ?? "application",
    raw_input: body,
  };

  return {
    company_id: companyId,
    created_by: userId,
    title: pickString(body.title, body.poste, body.role) || "",
    department: pickString(body.department),
    location: pickString(body.location),
    remote_policy: pickString(body.remote_policy),
    employment_type: pickString(body.employment_type),
    status: pickString(body.status) || "draft",
    priority: pickString(body.priority) || "medium",
    headcount: typeof body.headcount === "number" ? body.headcount : 1,
    salary_min: typeof salaryRange.min === "number" ? salaryRange.min : null,
    salary_max: typeof salaryRange.max === "number" ? salaryRange.max : null,
    salary_currency: pickString(salaryRange.currency, body.salary_currency) || "EUR",
    description: pickString(body.description, body.job_description),
    responsibilities: pickString(body.responsibilities),
    requirements: pickString(body.requirements),
    benefits: pickString(body.benefits),
    target_start_date: pickString(body.target_start_date),
    metadata,
  };
}

export async function GET() {
  try {
    const { supabase, companyId } = await getHrContext();
    const { data, error } = await supabase
      .from("missions")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message || "Unable to load missions");
    return NextResponse.json({ missions: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to load missions") }, { status: statusFromError(error) });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, companyId, authUserId } = await getHrContext({ recruiter: true });
    await assertUsageLimit({ companyId, eventType: "mission_create" });

    const body = asObject(await request.json().catch(() => ({})));
    const payload = missionPayload(body, companyId, authUserId);
    if (!payload.title) {
      return NextResponse.json({ error: "Mission title is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("missions")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(error.message || "Unable to create mission");

    await logUsageEvent({
      companyId,
      userId: authUserId,
      applicationId: data.id,
      eventType: "mission_create",
    });

    return NextResponse.json({ mission: data }, { status: 201 });
  } catch (error) {
    const message = messageFromError(error, "Unable to create mission");
    const status = message.includes("Usage limit") ? 402 : statusFromError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
