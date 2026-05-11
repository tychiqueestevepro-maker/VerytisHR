import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { asObject, pickString } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId } = await getHrContext();
    const { data, error } = await supabase
      .from("missions")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message || "Unable to load mission");
    if (!data) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

    return NextResponse.json({ mission: data });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to load mission") }, { status: statusFromError(error) });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId } = await getHrContext({ recruiter: true });
    const body = asObject(await request.json().catch(() => ({})));
    const updates: Record<string, unknown> = {};

    // Standard fields
    let status = pickString(body.status);
    if (status) {
      const allowedStatuses = new Set(["draft", "open", "active", "paused", "closed", "archived"]);
      if (!allowedStatuses.has(status)) {
        return NextResponse.json({ error: "Invalid mission status" }, { status: 400 });
      }
      // Map 'active' to 'open' for consistency with the recruitment cockpit
      updates.status = status === "active" ? "open" : status;
    }

    if (body.title) updates.title = String(body.title);
    if (body.department) updates.department = String(body.department);
    if (body.location) updates.location = String(body.location);
    if (body.seniority) updates.seniority = String(body.seniority);
    if (body.remote_policy) updates.remote_policy = String(body.remote_policy);
    if (body.employment_type) updates.employment_type = String(body.employment_type);
    if (body.salary_range) updates.salary_range = body.salary_range;
    if (body.description) updates.description = String(body.description);
    if (body.responsibilities) updates.responsibilities = String(body.responsibilities);
    if (body.requirements) updates.requirements = String(body.requirements);
    if (body.apply_enabled !== undefined) updates.apply_enabled = Boolean(body.apply_enabled);
    if (body.pipeline_generation_mode) updates.pipeline_generation_mode = String(body.pipeline_generation_mode);
    if (body.created_by) updates.created_by = String(body.created_by);

    // Metadata fields
    const { data: existing } = await supabase
      .from("missions")
      .select("metadata")
      .eq("company_id", companyId)
      .eq("id", id)
      .maybeSingle();
    
    const existingMeta = asObject(existing?.metadata);
    const metaUpdates: Record<string, unknown> = { ...existingMeta };

    const metaKeys = [
      "must_have_skills", "nice_to_have_skills", "company_context", "current_situation",
      "hiring_goal", "pain_challenge", "team_context", "team_workflow", "previous_team_work",
      "manager_expectations", "success_criteria", "generate_contextual_pipeline",
      "difficulty_level", "number_of_questions", "estimated_time_minutes", "question_types",
      "candidate_link_enabled", "require_cv_upload", "require_linkedin_url",
      "use_linkedin_verification", "require_cv_coherence", "fit_threshold", "trust_threshold"
    ];

    metaKeys.forEach(key => {
       if (body[key] !== undefined) metaUpdates[key] = body[key];
    });

    updates.metadata = metaUpdates;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("missions")
      .update(updates)
      .eq("company_id", companyId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message || "Unable to update mission");
    if (!data) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

    return NextResponse.json({ mission: data });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to update mission") }, { status: statusFromError(error) });
  }
}
