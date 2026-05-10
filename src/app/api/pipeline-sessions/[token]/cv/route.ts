import { NextResponse } from "next/server";
import { buildCandidateCvPath, CANDIDATE_CVS_BUCKET, ensureCandidateCvsBucket, parseCandidateDocument, publicDocumentFields } from "@/lib/hr/cv";
import { logUsageEvent } from "@/lib/hr/usage";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { asObject } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

export const runtime = "nodejs";

function statusFromMessage(message: string) {
  if (message.includes("not found")) return 404;
  if (message.includes("no longer active")) return 410;
  return 400;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await Promise.resolve(context.params);
    const supabase = createSupabaseServiceClient();
    const { data: session, error: sessionError } = await supabase
      .from("pipeline_sessions")
      .select("id, company_id, candidate_id, mission_id, status, expires_at")
      .eq("public_token", token)
      .maybeSingle();

    if (sessionError) throw new Error(sessionError.message || "Unable to load application session");
    if (!session) throw new Error("Session not found");

    const typedSession = asObject(session);
    if (["cancelled", "expired", "failed", "completed", "submitted", "analyzed", "incomplete"].includes(String(typedSession.status))) {
      throw new Error("Session is no longer active");
    }

    if (typedSession.expires_at && new Date(String(typedSession.expires_at)).getTime() < Date.now()) {
      throw new Error("Session is no longer active");
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CV file is required" }, { status: 400 });
    }

    const companyId = String(typedSession.company_id);
    const candidateId = String(typedSession.candidate_id);
    const applicationId = typedSession.mission_id ? String(typedSession.mission_id) : null;
    await ensureCandidateCvsBucket();

    const filePath = buildCandidateCvPath({
      companyId,
      candidateId,
      filename: file.name,
    });
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(CANDIDATE_CVS_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message || "Unable to upload CV");

    const { data: document, error: documentError } = await supabase
      .from("candidate_documents")
      .insert({
        company_id: companyId,
        candidate_id: candidateId,
        mission_id: applicationId,
        uploaded_by: null,
        document_type: "resume",
        status: "uploaded",
        storage_bucket: CANDIDATE_CVS_BUCKET,
        file_name: file.name,
        file_path: filePath,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        metadata: {
          uploaded_via: "public_apply",
          pipeline_session_id: typedSession.id,
        },
      })
      .select("*")
      .single();

    if (documentError) throw new Error(documentError.message || "Unable to save CV metadata");

    const parsed = await parseCandidateDocument(String(document.id), companyId);
    await logUsageEvent({
      companyId,
      applicationId,
      candidateId,
      eventType: "document_parse",
      provider: "openai",
      metadata: {
        document_id: document.id,
        pipeline_session_id: typedSession.id,
        uploaded_via: "public_apply",
      },
    });

    return NextResponse.json({ document: publicDocumentFields(parsed) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload CV";
    return NextResponse.json({ error: message }, { status: statusFromMessage(message) });
  }
}
