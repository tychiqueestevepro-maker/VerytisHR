import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { createMissionPipeline, getMissionPipeline } from "@/lib/hr/pipeline";
import { assertUsageLimit, logUsageEvent } from "@/lib/hr/usage";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { companyId } = await getHrContext();
    const pipeline = await getMissionPipeline(companyId, id);

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    return NextResponse.json(pipeline);
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to load mission pipeline") }, { status: statusFromError(error) });
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { companyId, authUserId } = await getHrContext({ recruiter: true });
    await assertUsageLimit({
      companyId,
      applicationId: id,
      eventType: "pipeline_generation",
    });

    const pipeline = await createMissionPipeline({
      companyId,
      applicationId: id,
      userId: authUserId,
    });

    await logUsageEvent({
      companyId,
      userId: authUserId,
      applicationId: id,
      eventType: "pipeline_generation",
      provider: "openai",
      metadata: {
        pipeline_id: pipeline?.pipeline?.id,
      },
    });

    return NextResponse.json(pipeline, { status: 201 });
  } catch (error) {
    const message = messageFromError(error, "Unable to create mission pipeline");
    const status = message.includes("Usage limit") ? 402 : statusFromError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
