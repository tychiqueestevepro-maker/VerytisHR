import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { checkUsageLimit, type HrUsageEventType } from "@/lib/hr/usage";
import { asObject, pickString } from "@/lib/hr/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { companyId } = await getHrContext();
    const body = asObject(await request.json().catch(() => ({})));
    const eventType = pickString(body.eventType, body.event_type) as HrUsageEventType | null;

    if (!eventType) {
      return NextResponse.json({ error: "eventType is required" }, { status: 400 });
    }

    const result = await checkUsageLimit({
      companyId,
      eventType,
      applicationId: pickString(body.applicationId, body.mission_id),
      candidateId: pickString(body.candidateId, body.candidate_id),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to check usage") }, { status: statusFromError(error) });
  }
}
