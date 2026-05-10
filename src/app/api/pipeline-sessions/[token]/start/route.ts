import { NextResponse } from "next/server";
import { identifyAndStartPipelineSession } from "@/lib/hr/pipeline-sessions";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusFromMessage(message: string) {
  if (message.includes("not found")) return 404;
  if (message.includes("completed")) return 409;
  if (message.includes("no longer active")) return 410;
  return 400;
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await Promise.resolve(context.params);
  const body = await request.json().catch(() => ({}));
  const payload = body as Record<string, unknown>;

  try {
    const data = await identifyAndStartPipelineSession(token, {
      email: typeof payload.email === "string" ? payload.email : "",
      linkedinUrl: typeof payload.linkedinUrl === "string" ? payload.linkedinUrl : typeof payload.linkedin_url === "string" ? payload.linkedin_url : "",
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = errorMessage(error, "Unable to start session");
    return NextResponse.json({ error: message }, { status: statusFromMessage(message) });
  }
}
