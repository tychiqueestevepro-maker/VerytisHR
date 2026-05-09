/**
 * Analysis cache — same input = same result, no redundant OpenAI calls.
 *
 * Hash includes: mission data, profile data, linkedin data, company research,
 * prompt version, scoring version, and model.
 * If any of these change, the cache is invalidated.
 */

import { createHash } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { asObject } from "./utils";

export function computeAnalysisHash(input: {
  missionData: unknown;
  profileData: unknown;
  linkedinData: unknown;
  companyResearch?: unknown;
  promptVersion: string;
  scoringVersion: string;
  model: string;
}): string {
  const payload = JSON.stringify({
    mission: input.missionData,
    profile: input.profileData,
    linkedin: input.linkedinData,
    research: input.companyResearch ?? null,
    prompt_version: input.promptVersion,
    scoring_version: input.scoringVersion,
    model: input.model,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export async function findCachedAnalysis(input: {
  companyId: string;
  inputHash: string;
  analysisType: string;
}): Promise<Record<string, unknown> | null> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("analysis_cache")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("input_hash", input.inputHash)
    .eq("analysis_type", input.analysisType)
    .maybeSingle();

  return data ? asObject(data) : null;
}

export async function storeCachedAnalysis(input: {
  companyId: string;
  inputHash: string;
  analysisType: string;
  result: Record<string, unknown>;
  promptVersion: string;
  scoringVersion: string;
  model: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  await supabase
    .from("analysis_cache")
    .upsert(
      {
        company_id: input.companyId,
        input_hash: input.inputHash,
        analysis_type: input.analysisType,
        result: input.result,
        prompt_version: input.promptVersion,
        scoring_version: input.scoringVersion,
        model: input.model,
        temperature: 0,
      },
      { onConflict: "company_id,input_hash,analysis_type" },
    );
}
