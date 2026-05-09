import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { buildCandidateCvPath, CANDIDATE_CVS_BUCKET, ensureCandidateCvsBucket, publicDocumentFields } from "@/lib/hr/cv";
import { pickString } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId, authUserId } = await getHrContext({ recruiter: true });

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("id")
      .eq("company_id", companyId)
      .eq("id", id)
      .maybeSingle();

    if (candidateError) throw new Error(candidateError.message || "Unable to load candidate");
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CV file is required" }, { status: 400 });
    }

    await ensureCandidateCvsBucket();

    const applicationId = pickString(form.get("applicationId"), form.get("mission_id"));
    const filePath = buildCandidateCvPath({
      companyId,
      candidateId: id,
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
        candidate_id: id,
        mission_id: applicationId,
        uploaded_by: authUserId,
        document_type: "resume",
        status: "uploaded",
        storage_bucket: CANDIDATE_CVS_BUCKET,
        file_name: file.name,
        file_path: filePath,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        metadata: {
          uploaded_via: "api",
        },
      })
      .select("*")
      .single();

    if (documentError) throw new Error(documentError.message || "Unable to save CV metadata");

    return NextResponse.json({ document: publicDocumentFields(document) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to upload CV") }, { status: statusFromError(error) });
  }
}
