import { NextResponse } from "next/server";
import { getHrContext, statusFromError, messageFromError } from "@/lib/hr/auth";
import { pickString } from "@/lib/hr/utils";

export async function POST(
  request: Request, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await params;
    const { supabase } = await getHrContext({ recruiter: true });
    const body = await request.json();
    const code = pickString(body.code);

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    // Find the latest pending challenge for this account
    const { data: challenge, error: challengeError } = await supabase
      .from("linkedin_challenges")
      .select("id")
      .eq("account_id", accountId)
      .eq("challenge_status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (challengeError || !challenge) {
      return NextResponse.json({ 
        error: "No pending challenge found for this account. It may have expired." 
      }, { status: 404 });
    }

    // Update the challenge with the code. 
    // The background Puppeteer process is polling for this.
    const { error: updateError } = await supabase
      .from("linkedin_challenges")
      .update({ 
        code, 
        challenge_status: "solved" 
      })
      .eq("id", challenge.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, message: "2FA code submitted successfully" });
  } catch (error) {
    return NextResponse.json({ error: messageFromError(error) }, { status: statusFromError(error) });
  }
}
