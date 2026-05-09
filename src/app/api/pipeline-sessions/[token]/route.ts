import { NextResponse } from "next/server";
import { getPipelineSessionByToken } from "@/lib/hr/pipeline-sessions";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await Promise.resolve(context.params);

  try {
    const data = await getPipelineSessionByToken(token);

    if (!data) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (data.session.status === "expired" || data.session.status === "cancelled") {
      return NextResponse.json({ error: "Session unavailable" }, { status: 410 });
    }

    const pipeline = data.pipeline as Record<string, unknown> | null;

    return NextResponse.json({
      session: {
        publicToken: data.session.public_token,
        status: data.session.status,
        expiresAt: data.session.expires_at,
        startedAt: data.session.started_at,
        submittedAt: data.session.submitted_at,
        candidateEmail: data.session.candidate_email,
        candidateName: data.session.candidate_name,
      },
      pipeline: pipeline
        ? {
            name: pipeline.name,
            description: pipeline.description,
            status: pipeline.status,
          }
        : null,
      mission: data.application,
      steps: data.steps,
      questions: data.questions,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error, "Unable to load session") }, { status: 400 });
  }
}
