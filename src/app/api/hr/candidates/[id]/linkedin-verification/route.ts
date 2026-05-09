import { NextResponse } from "next/server";
import { authenticateExtensionRequest } from "@/lib/hr/extension-tokens";
import { normalizeProfileImageInput, storeCandidateProfileImage } from "@/lib/hr/profile-images";
import { assertUsageLimit, logUsageEvent } from "@/lib/hr/usage";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { asObject, pickString } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

function statusFromMessage(message: string) {
  if (message.includes("token")) return 401;
  if (message.includes("not found")) return 404;
  if (message.includes("Usage limit")) return 402;
  if (message.includes("does not belong")) return 403;
  return 400;
}

function linkedinProfileIntelligence(body: Record<string, unknown>) {
  const nested = asObject(body.linkedin_profile_intelligence);
  if (Object.keys(nested).length) return nested;

  const profile = asObject(body.profile_intelligence);
  if (Object.keys(profile).length) return profile;

  return {};
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const extensionToken = await authenticateExtensionRequest(request);
    const body = asObject(await request.json().catch(() => ({})));
    const supabase = createSupabaseServiceClient();
    const profileIntelligence = linkedinProfileIntelligence(body);
    const profileIdentity = asObject(profileIntelligence.profile_identity);
    const currentPosition = asObject(profileIntelligence.current_position);

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("id, company_id, linkedin_url, current_title, current_company_name, location, raw_profile, metadata")
      .eq("id", id)
      .maybeSingle();

    if (candidateError) throw new Error(candidateError.message || "Unable to load candidate");
    if (!candidate) throw new Error("Candidate not found");
    if (candidate.company_id !== extensionToken.company_id) {
      throw new Error("Candidate does not belong to this extension token company");
    }

    await assertUsageLimit({
      companyId: extensionToken.company_id,
      candidateId: id,
      eventType: "linkedin_verification",
    });

    const verificationData = {
      ...body,
      linkedin_profile_intelligence: profileIntelligence,
      received_via: "chrome_extension",
    };
    const linkedinUrl = pickString(
      body.profile_url,
      body.linkedin_url,
      profileIdentity.linkedin_url,
      candidate.linkedin_url,
    );
    const profileName = pickString(
      body.linkedin_name,
      body.name,
      body.profile_name,
      profileIdentity.full_name,
    );
    const headline = pickString(body.headline, profileIdentity.headline);
    const currentCompany = pickString(body.current_company, body.currentCompany, currentPosition.company);
    const currentTitle = pickString(body.current_title, body.currentTitle, currentPosition.title);
    const location = pickString(body.location, profileIdentity.location);
    const profileImageInput = normalizeProfileImageInput(
      body.profile_image_url,
      body.profileImageUrl,
      body.photo_url,
      body.photoUrl,
      body.image_url,
      body.imageUrl,
      body.photo_data_url,
      body.photoDataUrl,
      profileIdentity.profile_image_url,
    );
    if (!linkedinUrl) {
      return NextResponse.json({ error: "LinkedIn profile URL is required" }, { status: 400 });
    }

    const profileImageUrl = await storeCandidateProfileImage(supabase, {
      companyId: extensionToken.company_id,
      candidateId: id,
      image: profileImageInput,
    });

    const { data: verification, error } = await supabase
      .from("linkedin_verifications")
      .insert({
        company_id: extensionToken.company_id,
        candidate_id: id,
        requested_by: extensionToken.user_id,
        linkedin_url: linkedinUrl,
        status: "verified",
        profile_name: profileName,
        headline,
        current_company: currentCompany,
        location,
        profile_image_url: profileImageUrl,
        confidence_score: typeof body.confidence_score === "number" ? body.confidence_score : 85,
        verification_data: verificationData,
        checked_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      console.error("[API] LinkedIn Verification Error:", error);
      throw new Error(error.message || "Unable to save LinkedIn verification");
    }

    console.log(`[API] LinkedIn Verification Success for candidate ${id}:`, {
      verification_id: verification.id,
      status: verification.status,
      profile_name: verification.profile_name
    });

    if (
      (linkedinUrl && !candidate.linkedin_url) ||
      (currentTitle && !pickString(candidate.current_title)) ||
      (currentCompany && !pickString(candidate.current_company_name)) ||
      (location && !pickString(candidate.location)) ||
      profileImageUrl ||
      Object.keys(profileIntelligence).length
    ) {
      const metadata = profileImageUrl
        ? {
            ...asObject(candidate.metadata),
            profile_image_url: profileImageUrl,
          }
        : undefined;
      const rawProfile = Object.keys(profileIntelligence).length
        ? {
            ...asObject(candidate.raw_profile),
            linkedin_profile_intelligence: profileIntelligence,
          }
        : undefined;

      await supabase
        .from("candidates")
        .update({
          ...(linkedinUrl && !candidate.linkedin_url ? { linkedin_url: linkedinUrl } : {}),
          ...(currentTitle && !pickString(candidate.current_title) ? { current_title: currentTitle } : {}),
          ...(currentCompany && !pickString(candidate.current_company_name) ? { current_company_name: currentCompany } : {}),
          ...(location && !pickString(candidate.location) ? { location } : {}),
          ...(metadata ? { metadata } : {}),
          ...(rawProfile ? { raw_profile: rawProfile } : {}),
        })
        .eq("id", id)
        .eq("company_id", extensionToken.company_id);
    }

    await logUsageEvent({
      companyId: extensionToken.company_id,
      userId: extensionToken.user_id,
      candidateId: id,
      eventType: "linkedin_verification",
      metadata: {
        verification_id: verification.id,
      },
    });

    return NextResponse.json({ verification }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save LinkedIn verification";
    return NextResponse.json({ error: message }, { status: statusFromMessage(message) });
  }
}
