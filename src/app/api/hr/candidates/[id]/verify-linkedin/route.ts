import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { scrapeLinkedInProfile } from "@/lib/hr/scraper/linkedin";
import { formatScrapedDataForVerification } from "@/lib/hr/scraper/scraper-utils";
import { asObject, pickString } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId } = await getHrContext({ recruiter: true });

    // 1. Get candidate
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("linkedin_url")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (candidateError || !candidate?.linkedin_url) {
      throw new Error("Candidate LinkedIn URL not found");
    }

    // 2. Get active LinkedIn session for the company
    const { data: linkedinAccount } = await supabase
      .from("linkedin_accounts")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "connected")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: linkedinSession } = linkedinAccount 
      ? await supabase
          .from("linkedin_sessions")
          .select("*")
          .eq("account_id", linkedinAccount.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    // Fallback to legacy cookie in company metadata
    const { data: companyRecord } = await supabase.from("companies").select("metadata").eq("id", companyId).maybeSingle();
    const companyMetadata = asObject(companyRecord?.metadata);
    const legacyCookie = pickString(companyMetadata.linkedin_session_cookie);
    const fullCookies = companyMetadata.linkedin_full_cookies; // Nouveau !

    const sessionData = linkedinSession?.session_data || fullCookies || legacyCookie;

    if (!sessionData) {
      throw new Error("No active LinkedIn session found. Please sync your extension in settings.");
    }

    // 3. Trigger Server-Side Scrape
    const scrapedProfile = await scrapeLinkedInProfile(
      candidate.linkedin_url, 
      sessionData,
      linkedinAccount?.proxy_config
    );

    if (!scrapedProfile) {
      throw new Error("LinkedIn scraper returned no data. Your session might be expired.");
    }

    // 4. Save results
    const verificationData = formatScrapedDataForVerification(scrapedProfile);
    
    const { data: newVerification, error: upsertError } = await supabase
      .from("linkedin_verifications")
      .upsert({
        company_id: companyId,
        candidate_id: id,
        linkedin_url: candidate.linkedin_url,
        ...verificationData,
        status: "verified",
        checked_at: new Date().toISOString()
      }, { onConflict: "candidate_id" })
      .select("*")
      .maybeSingle();

    if (upsertError) throw new Error(upsertError.message);

    return NextResponse.json({ 
      success: true, 
      verification: newVerification 
    });

  } catch (error) {
    return NextResponse.json(
      { error: messageFromError(error, "LinkedIn verification failed") },
      { status: statusFromError(error) }
    );
  }
}
