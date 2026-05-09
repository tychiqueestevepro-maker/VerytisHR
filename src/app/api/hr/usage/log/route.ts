import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { logUsageEvent, type HrUsageEventType } from "@/lib/hr/usage";
import { asObject, pickString } from "@/lib/hr/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { companyId, authUserId } = await getHrContext({ recruiter: true });
    const body = asObject(await request.json().catch(() => ({})));
    const eventType = pickString(body.eventType, body.event_type) as HrUsageEventType | null;

    if (!eventType) {
      return NextResponse.json({ error: "eventType is required" }, { status: 400 });
    }

    await logUsageEvent({
      companyId,
      userId: authUserId,
      applicationId: pickString(body.applicationId, body.mission_id),
      candidateId: pickString(body.candidateId, body.candidate_id),
      eventType,
      provider: pickString(body.provider),
      modelName: pickString(body.modelName, body.model_name),
      creditsDelta: typeof body.creditsDelta === "number" ? body.creditsDelta : 0,
      metadata: asObject(body.metadata),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to log usage") }, { status: statusFromError(error) });
  }
}
