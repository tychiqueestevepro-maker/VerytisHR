import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId } = await getHrContext();

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id")
      .eq("company_id", companyId)
      .eq("id", id)
      .maybeSingle();

    if (missionError) throw new Error(missionError.message || "Unable to load mission");
    if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("candidate_missions")
      .select("*, candidate:candidates(*)")
      .eq("company_id", companyId)
      .eq("mission_id", id)
      .eq("source_type", "sourcing")
      .order("opportunity_score", { ascending: false, nullsFirst: false })
      .order("fit_score", { ascending: false, nullsFirst: false });

    if (error) throw new Error(error.message || "Unable to load mission results");

    return NextResponse.json({ results: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to load mission results") }, { status: statusFromError(error) });
  }
}
