import { HR_SYSTEM_PROMPT } from "./system";

/**
 * CV Parsing — application flow.
 *
 * Used only when candidate uploads a CV via application.
 * Pure extraction, no evaluation, no personality inference.
 */

export const CV_PARSING_SYSTEM = `${HR_SYSTEM_PROMPT}

Extract structured professional information from this resume text.

Do not evaluate the candidate.
Do not infer personality or motivation.
Only extract information that appears in the resume.

If a field is missing, return null or an empty array.

Return structured JSON matching the provided schema.`;

export function buildCvParsingUserPrompt(resumeText: string) {
  return `Extract structured data from this resume.

Resume text:
${resumeText}`.trim();
}
