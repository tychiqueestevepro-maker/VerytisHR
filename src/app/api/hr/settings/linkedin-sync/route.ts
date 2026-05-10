import { NextResponse } from "next/server";
import { getHrContext, statusFromError, messageFromError } from "@/lib/hr/auth";
import { pickString } from "@/lib/hr/utils";

/**
 * API Route: Sync LinkedIn Cookie from Extension
 * POST /api/hr/settings/linkedin-sync
 * 
 * This allows the extension to automatically update the LinkedIn session cookie
 * used for server-side scraping, without manual F12 manipulation by the user.
 */
export async function POST(request: Request) {
  try {
    const { supabase, companyId } = await getHrContext({ recruiter: true });
    const body = await request.json();
    const cookie = pickString(body.cookie);

    if (!cookie) {
      return NextResponse.json({ error: "Cookie missing" }, { status: 400 });
    }

    // Store the cookie in the company metadata or a dedicated encrypted field
    // For now, we'll use a specific field in the company metadata
    const { data: company } = await supabase
      .from("companies")
      .select("metadata")
      .eq("id", companyId)
      .single();

    const nextMetadata = {
      ...(company?.metadata || {}),
      linkedin_session_cookie: cookie,
      linkedin_cookie_updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("companies")
      .update({ metadata: nextMetadata })
      .eq("id", companyId);

    if (updateError) throw updateError;

    return NextResponse.json({ 
      success: true, 
      message: "LinkedIn session synchronized" 
    });

  } catch (caught) {
    return NextResponse.json(
      { error: messageFromError(caught, "Unable to sync LinkedIn cookie") },
      { status: statusFromError(caught) }
    );
  }
}
