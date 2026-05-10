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

    if (data.session.status === "expired" || data.session.status === "cancelled" || data.session.status === "failed") {
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
        completedAt: data.session.completed_at,
        lastSeenAt: data.session.last_seen_at,
        candidateEmail: data.session.candidate_email,
        candidateLinkedinUrl: data.session.candidate_linkedin_url,
        candidateName: data.session.candidate_name,
        currentQuestionIndex: data.session.current_question_index,
        totalQuestions: data.session.total_questions,
        timeLimitMinutes: data.session.time_limit_minutes,
        timeSpentSeconds: data.session.time_spent_seconds,
        isFlagged: data.session.is_flagged,
        flagReason: data.session.flag_reason,
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
      responses: data.responses,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error, "Unable to load session") }, { status: 400 });
  }
}
