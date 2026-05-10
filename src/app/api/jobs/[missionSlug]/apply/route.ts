import { NextResponse } from "next/server";
import { createPublicMissionApplicationSession } from "@/lib/hr/public-apply";
import { asObject, pickString } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ missionSlug: string }> | { missionSlug: string };
};

export const runtime = "nodejs";

function statusFromMessage(message: string) {
  if (message.includes("not found")) return 404;
  if (message.includes("Usage limit")) return 402;
  return 400;
}

export async function POST(request: Request, context: RouteContext) {
  const { missionSlug } = await Promise.resolve(context.params);
  const body = asObject(await request.json().catch(() => ({})));

  try {
    const data = await createPublicMissionApplicationSession({
      missionSlug,
      email: pickString(body.email) ?? "",
      linkedinUrl: pickString(body.linkedinUrl, body.linkedin_url) ?? "",
    });

    return NextResponse.json({
      token: data.token,
      url: data.url,
      legacyUrl: data.legacyUrl,
      session: data.session,
      pipeline: data.pipeline,
      mission: data.mission,
      questions: data.questions,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start application";
    return NextResponse.json({ error: message }, { status: statusFromMessage(message) });
  }
}
