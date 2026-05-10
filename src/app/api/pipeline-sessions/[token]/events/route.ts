import { NextResponse } from "next/server";
import { logPipelineSessionEvent } from "@/lib/hr/pipeline-sessions";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await Promise.resolve(context.params);
  const body = await request.json().catch(() => ({}));
  const payload = body as Record<string, unknown>;

  try {
    const result = await logPipelineSessionEvent(token, {
      eventType: typeof payload.eventType === "string" ? payload.eventType : typeof payload.event_type === "string" ? payload.event_type : "unknown_event",
      questionId: typeof payload.questionId === "string" ? payload.questionId : typeof payload.question_id === "string" ? payload.question_id : null,
      eventData:
        payload.eventData && typeof payload.eventData === "object"
          ? (payload.eventData as Record<string, unknown>)
          : payload.event_data && typeof payload.event_data === "object"
            ? (payload.event_data as Record<string, unknown>)
            : {},
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error, "Unable to log event") }, { status: 400 });
  }
}
