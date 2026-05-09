import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { createPipelineSession } from "@/lib/hr/pipeline-sessions";
import { upsertCandidateMission } from "@/lib/hr/application-candidates";
import { assertUsageLimit, logUsageEvent } from "@/lib/hr/usage";
import { asObject, pickString } from "@/lib/hr/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, companyId, authUserId } = await getHrContext({ recruiter: true });
    const body = asObject(await request.json().catch(() => ({})));
    const candidateId = pickString(body.candidateId, body.candidate_id);
    const pipelineId = pickString(body.pipelineId, body.pipeline_id);

    if (!candidateId || !pipelineId) {
      return NextResponse.json({ error: "candidateId and pipelineId are required" }, { status: 400 });
    }

    await assertUsageLimit({
      companyId,
      eventType: "pipeline_session_created",
    });

    const [{ data: candidate }, { data: pipeline }] = await Promise.all([
      supabase
        .from("candidates")
        .select("id, email, first_name, last_name, company_id")
        .eq("company_id", companyId)
        .eq("id", candidateId)
        .maybeSingle(),
      supabase
        .from("pipelines")
        .select("id, mission_id, company_id")
        .eq("company_id", companyId)
        .eq("id", pipelineId)
        .maybeSingle(),
    ]);

    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

    const session = await createPipelineSession({
      companyId,
      candidateId,
      pipelineId,
      applicationId: pipeline.mission_id,
      candidateEmail: candidate.email,
      candidateName: [candidate.first_name, candidate.last_name].filter(Boolean).join(" ").trim() || null,
      expiresAt: pickString(body.expiresAt, body.expires_at),
      metadata: {
        created_via: "api",
      },
    });

    if (pipeline.mission_id) {
      await upsertCandidateMission({
        companyId,
        candidateId,
        applicationId: pipeline.mission_id,
        sourceType: "application",
        status: "screening",
        metadata: {
          application_session_id: session.id,
          application_pipeline_id: pipelineId,
        },
      });
    }

    await logUsageEvent({
      companyId,
      userId: authUserId,
      applicationId: pipeline.mission_id,
      candidateId,
      eventType: "pipeline_session_created",
      metadata: {
        pipeline_id: pipelineId,
        pipeline_session_id: session.id,
      },
    });

    return NextResponse.json(
      {
        session: {
          publicToken: session.public_token,
          status: session.status,
          expiresAt: session.expires_at,
          submittedAt: session.submitted_at,
          analyzedAt: session.analyzed_at,
          candidateEmail: session.candidate_email,
          candidateName: session.candidate_name,
        },
        url: `/apply/${session.public_token}`,
        legacyUrl: `/pipeline/session/${session.public_token}`,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = messageFromError(error, "Unable to create pipeline session");
    const status = message.includes("Usage limit") ? 402 : statusFromError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
