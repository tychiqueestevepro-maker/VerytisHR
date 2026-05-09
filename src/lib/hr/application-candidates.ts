import { createSupabaseServiceClient } from "@/lib/supabase/server";

type CandidateMissionStatus =
  | "new"
  | "imported"
  | "screening"
  | "qualified"
  | "interviewing"
  | "offer"
  | "hired"
  | "rejected"
  | "archived";

type CandidateMissionInput = {
  companyId: string;
  candidateId: string;
  applicationId: string;
  status?: CandidateMissionStatus;
  sourceType?: "sourcing" | "application";
  stage?: string | null;
  fitScore?: number | null;
  trustScore?: number | null;
  opportunityScore?: number | null;
  recommendation?: string | null;
  metadata?: Record<string, unknown>;
};

export async function upsertCandidateMission(input: CandidateMissionInput) {
  const supabase = createSupabaseServiceClient();

  const payload = {
    company_id: input.companyId,
    candidate_id: input.candidateId,
    mission_id: input.applicationId,
    status: input.status ?? "new",
    source_type: input.sourceType ?? "sourcing",
    stage: input.stage ?? null,
    fit_score: input.fitScore ?? null,
    trust_score: input.trustScore ?? null,
    opportunity_score: input.opportunityScore ?? null,
    recommendation: input.recommendation ?? null,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("candidate_missions")
    .upsert(payload, { onConflict: "candidate_id,mission_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "Unable to attach candidate to mission");
  }

  return data;
}
