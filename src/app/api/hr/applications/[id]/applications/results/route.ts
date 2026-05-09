import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { getMissionPipelineResults } from "@/lib/hr/pipeline";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { companyId } = await getHrContext();
    const results = await getMissionPipelineResults(companyId, id);

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to load application results") }, { status: statusFromError(error) });
  }
}
