import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { getMissionWorkSamples, publicWorkSampleFields, storeMissionWorkSample } from "@/lib/hr/work-samples";
import { pickString } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

const SAMPLE_TYPES = new Set([
  "task",
  "client_case",
  "code",
  "process",
  "mission_example",
  "business_situation",
  "real_team_material",
  "other",
]);

function normalizeSampleType(value: unknown) {
  const sampleType = pickString(value)?.toLowerCase();
  return sampleType && SAMPLE_TYPES.has(sampleType) ? sampleType : "real_team_material";
}

async function assertMission(
  supabase: Awaited<ReturnType<typeof getHrContext>>["supabase"],
  companyId: string,
  missionId: string,
) {
  const { data, error } = await supabase
    .from("missions")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", missionId)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load mission");
  if (!data) throw new Error("Mission not found");
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId } = await getHrContext();
    await assertMission(supabase, companyId, id);

    const samples = await getMissionWorkSamples({ companyId, missionId: id });
    return NextResponse.json({ samples: samples.map(publicWorkSampleFields) });
  } catch (error) {
    const message = messageFromError(error, "Unable to load work samples");
    const status = message === "Mission not found" ? 404 : statusFromError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId, authUserId } = await getHrContext({ recruiter: true });
    await assertMission(supabase, companyId, id);

    const form = await request.formData();
    const sampleType = normalizeSampleType(form.get("sampleType") ?? form.get("sample_type"));
    const content = pickString(form.get("content"));
    const file = form.get("file");
    const rows = [];

    if (content) {
      rows.push(await storeMissionWorkSample({
        supabase,
        companyId,
        missionId: id,
        userId: authUserId,
        filename: pickString(form.get("contentFilename")) ?? "pasted-work-sample.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(content, "utf8"),
        sampleType,
        metadata: {
          uploaded_via: "application_create_form",
          source: "pasted_text",
        },
      }));
    }

    if (file instanceof File && file.size > 0) {
      rows.push(await storeMissionWorkSample({
        supabase,
        companyId,
        missionId: id,
        userId: authUserId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer: Buffer.from(await file.arrayBuffer()),
        sampleType,
        metadata: {
          uploaded_via: "application_create_form",
          source: "file_upload",
        },
      }));
    }

    if (!rows.length) {
      return NextResponse.json({ error: "Work sample content or file is required" }, { status: 400 });
    }

    return NextResponse.json({ samples: rows.map(publicWorkSampleFields) }, { status: 201 });
  } catch (error) {
    const message = messageFromError(error, "Unable to upload work sample");
    const status = message === "Mission not found" ? 404 : statusFromError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
