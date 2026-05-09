import { NextResponse } from "next/server";
import {
  type PipelineSessionResponseInput,
  submitPipelineSessionResponses,
  updatePipelineSessionCandidateProfile,
} from "@/lib/hr/pipeline-sessions";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function parseResponses(value: unknown): PipelineSessionResponseInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      questionId: String(item.questionId || ""),
      responseText: typeof item.responseText === "string" ? item.responseText : null,
      responseJson:
        item.responseJson && typeof item.responseJson === "object"
          ? (item.responseJson as Record<string, unknown> | unknown[])
          : {},
      fileDocumentId: typeof item.fileDocumentId === "string" ? item.fileDocumentId : null,
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
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = errorMessage(error, "Unable to submit responses");
    const status = message.includes("not found") ? 404 : message.includes("already submitted") ? 409 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
