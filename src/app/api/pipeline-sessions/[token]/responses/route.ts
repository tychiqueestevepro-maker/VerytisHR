import { NextResponse } from "next/server";
import {
  type PipelineSessionResponseInput,
  submitPipelineSessionAnswer,
  submitPipelineSessionResponses,
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
    .map((item) => {
      const status: PipelineSessionResponseInput["status"] = item.status === "timed_out"
        ? "timed_out"
        : item.status === "draft"
          ? "draft"
          : "locked";

      return {
        questionId: String(item.questionId || ""),
        responseText: typeof item.responseText === "string" ? item.responseText : null,
        responseJson:
          item.responseJson && typeof item.responseJson === "object"
            ? (item.responseJson as Record<string, unknown> | unknown[])
            : {},
        fileDocumentId: typeof item.fileDocumentId === "string" ? item.fileDocumentId : null,
        status,
      };
    })
    .filter((item) => item.questionId);
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await Promise.resolve(context.params);
  const body = await request.json().catch(() => ({}));
  const payload = body as Record<string, unknown>;
  const singleResponse = payload.response && typeof payload.response === "object"
    ? parseResponses([payload.response])[0]
    : null;
  const responses = singleResponse ? [] : parseResponses(payload.responses);

  try {
    const result = singleResponse
      ? await submitPipelineSessionAnswer(token, singleResponse)
      : await submitPipelineSessionResponses(token, responses);
    
    // Automatisation : On lance l'analyse si la session est terminée
    if (result.completed) {
      try {
        const { analyzePipelineSession } = await import("@/lib/hr/pipeline");
        // On lance l'analyse en arrière-plan pour ne pas bloquer le candidat
        analyzePipelineSession(token).catch(err => {
          console.error(`[Pipeline] Async analysis failed for token ${token}:`, err);
        });
        console.log(`[Pipeline] Automatic analysis triggered for session token ${token}`);
      } catch (analysisError) {
        console.error("[Pipeline] Failed to trigger automatic analysis:", analysisError);
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = errorMessage(error, "Unable to submit responses");
    const status = message.includes("not found")
      ? 404
      : message.includes("already") || message.includes("locked") || message.includes("Previous questions")
        ? 409
        : message.includes("no longer active")
          ? 410
          : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
