import { NextResponse } from "next/server";
import { getPipelineSessionByToken } from "@/lib/hr/pipeline-sessions";
import { analyzePipelineSession } from "@/lib/hr/pipeline";
import { assertUsageLimit, logUsageEvent } from "@/lib/hr/usage";
import { asObject, pickString } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

export const runtime = "nodejs";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(_request: Request, context: RouteContext) {
  const { token } = await Promise.resolve(context.params);

  try {
    const sessionData = await getPipelineSessionByToken(token);
    if (!sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (sessionData.session.status !== "analyzed") {
      await assertUsageLimit({
        companyId: sessionData.session.company_id,
        applicationId: sessionData.session.mission_id,
        candidateId: sessionData.session.candidate_id,
        eventType: "pipeline_response_analysis",
      });
    }

    const result = await analyzePipelineSession(token);
    const score = asObject(result.pipelineScore);

    if (!result.alreadyAnalyzed) {
      await logUsageEvent({
        companyId: sessionData.session.company_id,
        applicationId: sessionData.session.mission_id,
        candidateId: sessionData.session.candidate_id,
        eventType: "pipeline_response_analysis",
        provider: pickString(score.model_name) === "heuristic" ? "internal" : "openai",
        modelName: pickString(score.model_name),
        metadata: {
          pipeline_id: sessionData.session.pipeline_id,
          pipeline_session_id: sessionData.session.id,
          pipeline_score_id: score.id,
          score: score.score,
        },
      });
    }

    return NextResponse.json({
      success: true,
      analyzedAt: result.analyzedAt,
      score: {
        score: score.score,
        level: score.level,
        analysis: score.analysis,
        criteria: score.criteria,
      },
    });
  } catch (error: unknown) {
    const message = errorMessage(error, "Unable to analyze pipeline session");
    const status = message.includes("Usage limit") ? 402 : message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
