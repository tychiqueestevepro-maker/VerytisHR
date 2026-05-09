import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId } = await getHrContext();

    const { data: candidate, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message || "Unable to load candidate");
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    const [
      { data: missions },
      { data: documents },
      { data: linkedinVerifications },
      { data: scores },
      { data: signals },
      { data: inconsistencies },
    ] = await Promise.all([
      supabase
        .from("candidate_missions")
        .select("*, mission:missions(*)")
        .eq("company_id", companyId)
        .eq("candidate_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("candidate_documents")
        .select("id, mission_id, document_type, status, storage_bucket, file_name, file_path, mime_type, file_size_bytes, parsed_data, created_at, updated_at")
        .eq("company_id", companyId)
        .eq("candidate_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("linkedin_verifications")
        .select("*")
        .eq("company_id", companyId)
        .eq("candidate_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("candidate_scores")
        .select("*")
        .eq("company_id", companyId)
        .eq("candidate_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("candidate_signals")
        .select("*")
        .eq("company_id", companyId)
        .eq("candidate_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("candidate_inconsistencies")
        .select("*")
        .eq("company_id", companyId)
        .eq("candidate_id", id)
        .order("created_at", { ascending: false }),
    ]);

    return NextResponse.json({
      candidate,
      missions: missions ?? [],
      documents: documents ?? [],
      linkedinVerifications: linkedinVerifications ?? [],
      scores: scores ?? [],
      signals: signals ?? [],
      inconsistencies: inconsistencies ?? [],
    });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to load candidate") }, { status: statusFromError(error) });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId } = await getHrContext({ recruiter: true });

    const { error } = await supabase
      .from("candidates")
      .delete()
      .eq("company_id", companyId)
      .eq("id", id);

    if (error) throw new Error(error.message || "Unable to delete candidate");

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to delete candidate") }, { status: statusFromError(error) });
  }
}

