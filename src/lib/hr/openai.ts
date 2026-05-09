import OpenAI from "openai";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { asObject, parseJsonObject } from "./utils";

export const HR_FAST_MODEL = process.env.OPENAI_HR_FAST_MODEL ?? "gpt-5.4-nano";
export const HR_CORE_MODEL = process.env.OPENAI_HR_CORE_MODEL ?? "gpt-5.4-mini";
export const HR_REVIEW_MODEL = process.env.OPENAI_HR_REVIEW_MODEL ?? "gpt-5.5";

export async function getOpenAIKeyForCompany(companyId: string) {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();

  const settings = asObject(data?.settings);
  const companyKey = settings.openai_api_key;
  if (typeof companyKey === "string" && companyKey.trim()) return companyKey.trim();

  return process.env.OPENAI_API_KEY?.trim() || null;
}

/**
 * Call OpenAI with strict structured outputs.
 *
 * Rules enforced:
 * - temperature: 0 (deterministic, no creative drift)
 * - top_p: 1
 * - json_schema strict: true when schema provided
 * - fallback to json_object mode when no schema (backward compat)
 */
export async function completeHrJson(input: {
  companyId: string;
  system: string;
  user: string;
  model?: string;
  /** JSON Schema object for strict structured outputs */
  schema?: Record<string, unknown>;
  /** Schema name identifier (required when schema is provided) */
  schemaName?: string;
}) {
  const apiKey = await getOpenAIKeyForCompany(input.companyId);
  if (!apiKey) return null;

  const openai = new OpenAI({ apiKey });
  const model = input.model || HR_CORE_MODEL;

  // Structured outputs strict mode when schema provided, else basic JSON mode
  const responseFormat =
    input.schema && input.schemaName
      ? ({
          type: "json_schema",
          json_schema: {
            name: input.schemaName,
            strict: true,
            schema: input.schema,
          },
        } as unknown as OpenAI.ChatCompletionCreateParams["response_format"])
      : ({ type: "json_object" } as OpenAI.ChatCompletionCreateParams["response_format"]);

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0,
    top_p: 1,
    response_format: responseFormat,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned an empty response");

  return {
    model: completion.model || model,
    data: parseJsonObject(raw),
  };
}
