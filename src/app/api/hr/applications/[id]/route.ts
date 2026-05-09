import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { asObject, pickString } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId } = await getHrContext();
    const { data, error } = await supabase
      .from("missions")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message || "Unable to load mission");
    if (!data) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

    return NextResponse.json({ mission: data });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to load mission") }, { status: statusFromError(error) });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId } = await getHrContext({ recruiter: true });
    const body = asObject(await request.json().catch(() => ({})));
    const status = pickString(body.status);
    const allowedStatuses = new Set(["draft", "open", "paused", "closed", "archived"]);
    const updates: Record<string, unknown> = {};

    if (status) {
      if (!allowedStatuses.has(status)) {
        return NextResponse.json({ error: "Invalid mission status" }, { status: 400 });
      }
      updates.status = status;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No mission updates provided" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("missions")
      .update(updates)
      .eq("company_id", companyId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message || "Unable to update mission");
    if (!data) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

    return NextResponse.json({ mission: data });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error, "Unable to update mission") }, { status: statusFromError(error) });
  }
}
