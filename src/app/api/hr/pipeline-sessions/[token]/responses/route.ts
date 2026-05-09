import { NextResponse } from "next/server";
import {
  type PipelineSessionResponseInput,
  submitPipelineSessionResponses,
  updatePipelineSessionCandidateProfile,
} from "@/lib/hr/pipeline-sessions";
import { logUsageEvent } from "@/lib/hr/usage";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

export const runtime = "nodejs";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function parseResponses(value: unknown): PipelineSessionResponseInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      questionId: String(item.questionId || item.question_id || ""),
      responseText: typeof item.responseText === "string" ? item.responseText : typeof item.response_text === "string" ? item.response_text : null,
      responseJson:
        item.responseJson && typeof item.responseJson === "object"
          ? (item.responseJson as Record<string, unknown> | unknown[])
          : item.response_json && typeof item.response_json === "object"
            ? (item.response_json as Record<string, unknown> | unknown[])
            : {},
      fileDocumentId: typeof item.fileDocumentId === "string" ? item.fileDocumentId : typeof item.file_document_id === "string" ? item.file_document_id : null,
    }))
    .filter((item) => item.questionId);
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await Promise.resolve(context.params);
  const body = await request.json().catch(() => ({}));
  const payload = body as Record<string, unknown>;
  const responses = parseResponses(payload.responses);

  try {
    await updatePipelineSessionCandidateProfile(token, {
      linkedinUrl: typeof payload.linkedinUrl === "string" ? payload.linkedinUrl : typeof payload.linkedin_url === "string" ? payload.linkedin_url : null,
    });
    const result = await submitPipelineSessionResponses(token, responses);
    await logUsageEvent({
      companyId: result.companyId,
      applicationId: result.applicationId,
      candidateId: result.candidateId,
      eventType: "pipeline_submit",
      metadata: {
        pipeline_id: result.pipelineId,
        pipeline_session_id: result.sessionId,
        responses_count: responses.length,
      },
    });

    return NextResponse.json({ success: true, submittedAt: result.submittedAt });
  } catch (error: unknown) {
    const message = errorMessage(error, "Unable to submit responses");
    const status = message.includes("not found") ? 404 : message.includes("already submitted") ? 409 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
