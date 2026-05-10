import { NextResponse } from "next/server";
import { openPipelineQuestion } from "@/lib/hr/pipeline-sessions";

type RouteContext = {
  params: Promise<{ token: string; questionId: string }> | { token: string; questionId: string };
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusFromMessage(message: string) {
  if (message.includes("not found")) return 404;
  if (message.includes("completed") || message.includes("locked")) return 409;
  if (message.includes("no longer active")) return 410;
  return 400;
}

export async function POST(_request: Request, context: RouteContext) {
  const { token, questionId } = await Promise.resolve(context.params);

  try {
    const data = await openPipelineQuestion(token, questionId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = errorMessage(error, "Unable to open question");
    return NextResponse.json({ error: message }, { status: statusFromMessage(message) });
  }
}
