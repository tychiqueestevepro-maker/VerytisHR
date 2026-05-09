import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { upsertCandidateMission } from "@/lib/hr/application-candidates";
import { assertUsageLimit, logUsageEvent } from "@/lib/hr/usage";
import { asObject, normalizeEmail, pickString, splitName } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

async function assertMission(supabase: ReturnType<typeof import("@/lib/supabase/server").createSupabaseServiceClient>, companyId: string, applicationId: string) {
  const { data, error } = await supabase
    .from("missions")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", applicationId)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load mission");
  if (!data) throw new Error("Mission not found");
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId } = await getHrContext();
    await assertMission(supabase, companyId, id);

    const { data, error } = await supabase
      .from("candidate_missions")
      .select("*, candidate:candidates(*)")
      .eq("company_id", companyId)
      .eq("mission_id", id)
      .eq("source_type", "sourcing")
      .order("fit_score", { ascending: false, nullsFirst: false })
      .order("trust_score", { ascending: false, nullsFirst: false });

    if (error) throw new Error(error.message || "Unable to load candidates");
    return NextResponse.json({ candidates: data ?? [] });
  } catch (error) {
    const message = messageFromError(error, "Unable to load candidates");
    const status = message === "Mission not found" ? 404 : statusFromError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId, authUserId } = await getHrContext({ recruiter: true });
    await assertMission(supabase, companyId, id);
    await assertUsageLimit({ companyId, eventType: "candidate_import" });

    const body = asObject(await request.json().catch(() => ({})));
    const fullName = pickString(body.name, body.full_name);
    const split = splitName(fullName);
    const email = normalizeEmail(body.email);
    const linkedinUrl = pickString(body.linkedin_url, body.linkedinUrl);

    let existingCandidate = null;
    if (email) {
      const { data } = await supabase
        .from("candidates")
        .select("*")
        .eq("company_id", companyId)
        .eq("email", email)
        .maybeSingle();
      existingCandidate = data;
    }

    if (!existingCandidate && linkedinUrl) {
      const { data } = await supabase
        .from("candidates")
        .select("*")
        .eq("company_id", companyId)
        .eq("linkedin_url", linkedinUrl)
        .maybeSingle();
      existingCandidate = data;
    }

    const candidatePayload = {
      company_id: companyId,
      created_by: authUserId,
      first_name: pickString(body.first_name, split.firstName),
      last_name: pickString(body.last_name, split.lastName),
      email,
      phone: pickString(body.phone),
      linkedin_url: linkedinUrl,
      location: pickString(body.location),
      country: pickString(body.country),
      current_title: pickString(body.current_title, body.currentTitle),
      current_company_name: pickString(body.current_company, body.current_company_name, body.currentCompany),
      source: pickString(body.source) || "manual",
      status: "imported",
      raw_profile: asObject(body.raw_profile),
      metadata: {
        imported_via: "api",
        mission_id: id,
      },
    };

    const { data: candidate, error: candidateError } = existingCandidate
      ? await supabase
          .from("candidates")
          .update(Object.fromEntries(Object.entries(candidatePayload).filter(([, value]) => value !== null)))
          .eq("id", existingCandidate.id)
          .eq("company_id", companyId)
          .select("*")
          .single()
      : await supabase
          .from("candidates")
          .insert(candidatePayload)
          .select("*")
          .single();

    if (candidateError) throw new Error(candidateError.message || "Unable to save candidate");

    const candidateMission = await upsertCandidateMission({
      companyId,
      candidateId: candidate.id,
      applicationId: id,
      sourceType: "sourcing",
      status: "imported",
      stage: pickString(body.stage),
    });

    await logUsageEvent({
      companyId,
      userId: authUserId,
      applicationId: id,
      candidateId: candidate.id,
      eventType: "candidate_import",
    });

    return NextResponse.json({ candidate, candidateMission }, { status: 201 });
  } catch (error) {
    const message = messageFromError(error, "Unable to import candidate");
    const status = message.includes("Usage limit") ? 402 : message === "Mission not found" ? 404 : statusFromError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
