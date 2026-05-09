import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { analyzeSourcingProfileForMission } from "@/lib/hr/sourcing";
import { assertUsageLimit, logUsageEvent } from "@/lib/hr/usage";
import { asObject, pickString } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { companyId, authUserId } = await getHrContext({ recruiter: true });
    const body = asObject(await request.json().catch(() => ({})));
    const applicationId = pickString(body.applicationId, body.mission_id);

    await assertUsageLimit({
      companyId,
      applicationId,
      candidateId: id,
      eventType: "ai_score",
    });

    const result = await analyzeSourcingProfileForMission({
      companyId,
      candidateId: id,
      applicationId,
      scoredBy: authUserId,
    });

    await logUsageEvent({
      companyId,
      userId: authUserId,
      candidateId: id,
      applicationId: pickString(asObject(result.candidateMission).mission_id),
      eventType: "ai_score",
      provider: result.model === "heuristic" ? "internal" : "openai",
      modelName: result.model,
      metadata: {
        flow: "sourcing",
        fit_score: result.fitScore,
        opportunity_score: result.opportunityScore,
      },
    });

    return NextResponse.json({ analysis: result });
  } catch (error) {
    const message = messageFromError(error, "Unable to analyze sourcing profile");
    const status = message.includes("Usage limit") ? 402 : statusFromError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
