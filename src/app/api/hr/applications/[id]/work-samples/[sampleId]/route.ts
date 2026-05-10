import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import {
  createMissionWorkSampleSignedUrl,
  deleteMissionWorkSample,
  getMissionWorkSample,
  publicWorkSampleFields,
} from "@/lib/hr/work-samples";

type RouteContext = {
  params: Promise<{ id: string; sampleId: string }> | { id: string; sampleId: string };
};

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id, sampleId } = await Promise.resolve(context.params);
    const { supabase, companyId } = await getHrContext();

    const sample = await getMissionWorkSample({
      supabase,
      companyId,
      missionId: id,
      sampleId,
    });

    if (!sample) {
      return NextResponse.json({ error: "Work sample not found" }, { status: 404 });
    }

    const signedUrl = await createMissionWorkSampleSignedUrl({ supabase, sample });
    if (signedUrl && new URL(request.url).searchParams.get("open") === "1") {
      return NextResponse.redirect(signedUrl);
    }

    return NextResponse.json({
      sample: publicWorkSampleFields(sample),
      signedUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: messageFromError(error, "Unable to open work sample") },
      { status: statusFromError(error) },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id, sampleId } = await Promise.resolve(context.params);
    const { supabase, companyId } = await getHrContext({ recruiter: true });

    const deleted = await deleteMissionWorkSample({
      supabase,
      companyId,
      missionId: id,
      sampleId,
    });

    if (!deleted) {
      return NextResponse.json({ error: "Work sample not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: messageFromError(error, "Unable to delete work sample") },
      { status: statusFromError(error) },
    );
  }
}
