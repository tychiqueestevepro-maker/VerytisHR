import { NextResponse } from "next/server";
import { getHrContext, messageFromError, statusFromError } from "@/lib/hr/auth";
import { upsertCandidateMission } from "@/lib/hr/application-candidates";
import { normalizeProfileImageInput, storeCandidateProfileImage } from "@/lib/hr/profile-images";
import { assertUsageLimit, logUsageEvent } from "@/lib/hr/usage";
import { asObject, normalizeImportedCandidateName, pickString } from "@/lib/hr/utils";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export const runtime = "nodejs";

const CANDIDATE_SOURCES = new Set(["manual", "linkedin", "import", "referral", "application", "agency", "other"]);
const REMOVED_RAW_PROFILE_KEYS = new Set([
  "email",
  "e mail",
  "mail",
  "work email",
  "personal email",
  "department",
  "departments",
  "company linkedin",
  "company linkedin url",
  "annual revenue",
  "revenue",
  "company description",
  "description",
]);

function candidateSource(value: unknown) {
  const source = pickString(value)?.toLowerCase();
  if (!source) return "import";
  if (CANDIDATE_SOURCES.has(source)) return source;
  if (source.includes("linkedin")) return "linkedin";
  if (source.includes("csv") || source.includes("apollo") || source.includes("spreadsheet") || source.includes("ats")) return "import";
  return "other";
}

function rawProfileKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldRemoveRawProfileKey(key: string) {
  const normalized = rawProfileKey(key);
  return (
    REMOVED_RAW_PROFILE_KEYS.has(normalized) ||
    normalized.includes("email") ||
    normalized.includes("department") ||
    normalized.includes("company linkedin") ||
    normalized.includes("annual revenue") ||
    normalized.includes("company description")
  );
}

function leanRawProfile(value: unknown) {
  return Object.fromEntries(
    Object.entries(asObject(value)).filter(([key]) => !shouldRemoveRawProfileKey(key)),
  );
}

async function assertMission(supabase: Awaited<ReturnType<typeof getHrContext>>["supabase"], companyId: string, applicationId: string) {
  const { data, error } = await supabase
    .from("missions")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", applicationId)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load mission");
  if (!data) throw new Error("Mission not found");
}

async function importOne(input: {
  supabase: Awaited<ReturnType<typeof getHrContext>>["supabase"];
  companyId: string;
  userId: string;
  applicationId: string;
  body: Record<string, unknown>;
}) {
  const rawProfile = asObject(input.body.raw_profile);
  const normalizedName = normalizeImportedCandidateName({
    fullName: pickString(input.body.name, input.body.full_name, rawProfile.Name, rawProfile["Full Name"], rawProfile["Contact Name"], rawProfile["Person Name"]),
    firstName: input.body.first_name,
    lastName: input.body.last_name,
  });
  const email = null;
  const linkedinUrl = pickString(input.body.linkedin_url, input.body.linkedinUrl);
  const profileImageInput = normalizeProfileImageInput(
    input.body.profile_image_url,
    input.body.profileImageUrl,
    input.body.photo_url,
    input.body.photoUrl,
    input.body.image_url,
    input.body.imageUrl,
    input.body.photo_data_url,
    input.body.photoDataUrl,
  );
  const directProfileImageUrl = profileImageInput?.startsWith("data:image/") ? null : profileImageInput;

  let existingCandidate = null;
  if (!existingCandidate && linkedinUrl) {
    const { data } = await input.supabase
      .from("candidates")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("linkedin_url", linkedinUrl)
      .maybeSingle();
    existingCandidate = data;
  }

  const candidatePayload = {
    company_id: input.companyId,
    created_by: input.userId,
    first_name: normalizedName.firstName,
    last_name: normalizedName.lastName,
    email,
    phone: pickString(input.body.phone),
    linkedin_url: linkedinUrl,
    location: pickString(input.body.location),
    country: pickString(input.body.country),
    current_title: pickString(input.body.current_title, input.body.currentTitle),
    current_company_name: pickString(input.body.current_company, input.body.current_company_name, input.body.currentCompany),
    source: candidateSource(input.body.source),
    status: "imported",
    raw_profile: {
      ...leanRawProfile(input.body.raw_profile),
      seniority: pickString(input.body.seniority),
      industry: pickString(input.body.industry),
      company_website: pickString(input.body.company_website),
      company_size: pickString(input.body.company_size),
      person_location: pickString(input.body.person_location),
    },
    metadata: {
      imported_via: "sourcing_import",
      mission_id: input.applicationId,
      import_batch: pickString(input.body.import_batch),
      display_name: normalizedName.displayName,
      profile_image_url: directProfileImageUrl,
    },
  };

  const { data: candidate, error: candidateError } = existingCandidate
    ? await input.supabase
        .from("candidates")
        .update(Object.fromEntries(Object.entries(candidatePayload).filter(([, value]) => value !== null)))
        .eq("id", existingCandidate.id)
        .eq("company_id", input.companyId)
        .select("*")
        .single()
    : await input.supabase
        .from("candidates")
        .insert(candidatePayload)
        .select("*")
        .single();

  if (candidateError) throw new Error(candidateError.message || "Unable to save sourcing profile");

  if (profileImageInput) {
    const storedProfileImageUrl = await storeCandidateProfileImage(input.supabase, {
      companyId: input.companyId,
      candidateId: candidate.id,
      image: profileImageInput,
    });

    if (storedProfileImageUrl) {
      await input.supabase
        .from("candidates")
        .update({
          metadata: {
            ...asObject(candidate.metadata),
            profile_image_url: storedProfileImageUrl,
          },
        })
        .eq("id", candidate.id)
        .eq("company_id", input.companyId);
    }
  }

  const candidateMission = await upsertCandidateMission({
    companyId: input.companyId,
    candidateId: candidate.id,
    applicationId: input.applicationId,
    sourceType: "sourcing",
    status: "imported",
    stage: pickString(input.body.stage),
    metadata: {
      imported_via: "sourcing_import",
      import_source: pickString(input.body.import_source, input.body.source) ?? "manual",
    },
  });

  return { candidate, candidateMission };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const { supabase, companyId, authUserId } = await getHrContext({ recruiter: true });
    await assertMission(supabase, companyId, id);

    const body = await request.json().catch(() => ({}));
    const profiles = Array.isArray((body as Record<string, unknown>).profiles)
      ? ((body as Record<string, unknown>).profiles as unknown[]).map(asObject)
      : Array.isArray(body)
        ? body.map(asObject)
        : [asObject(body)];

    const imported = [];
    for (const profile of profiles) {
      await assertUsageLimit({ companyId, eventType: "candidate_import" });
      const result = await importOne({
        supabase,
        companyId,
        userId: authUserId,
        applicationId: id,
        body: profile,
      });
      imported.push(result);

      await logUsageEvent({
        companyId,
        userId: authUserId,
        applicationId: id,
        candidateId: result.candidate.id,
        eventType: "candidate_import",
        metadata: {
          flow: "sourcing",
          candidate_mission_id: result.candidateMission.id,
        },
      });
    }

    return NextResponse.json({ imported }, { status: 201 });
  } catch (error) {
    const message = messageFromError(error, "Unable to import sourcing profiles");
    const status = message.includes("Usage limit") ? 402 : message === "Mission not found" ? 404 : statusFromError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
