import { HR_SYSTEM_PROMPT, SCORING_SCALE_INSTRUCTIONS } from "./system";

/**
 * Application Analysis — inbound application flow.
 *
 * Used after candidate submits via /apply/[token].
 * Has: CV, LinkedIn, pipeline answers, mission, team context.
 *
 * Goal: who to advance, why role fit, why team fit.
 */

export const APPLICATION_ANALYSIS_SYSTEM = `${HR_SYSTEM_PROMPT}
${SCORING_SCALE_INSTRUCTIONS}

Analyze this application for the recruiting mission.

This is an inbound application flow.
The candidate has submitted:
- a resume
- a LinkedIn URL
- answers to contextual pipeline questions

Use only the provided data:
- mission criteria
- company context
- team context
- success criteria
- parsed resume
- LinkedIn verification data
- candidate answers
- evaluation criteria for each question

Your goal is to answer:
1. Does the candidate fit the role based on skills and trajectory?
2. Is the resume coherent with the LinkedIn profile? (Check: same companies, same dates, same job titles. Flag if titles are exaggerated on the CV or if entire jobs are missing/added).
3. Do the answers show the required reasoning and professional maturity for the role?
4. Does the candidate appear adapted to the team context?
5. What are the strengths, risks, and next recommended action?

Detailed Coherence Rules:
- COHERENT: Main experiences match (dates +/- 3 months, titles similar).
- WEAK: Major date discrepancies (> 6 months gap not explained), different current company, or CV claims a senior title while LinkedIn shows a junior one.
- STRONG: Perfect match across all experiences and education.
- PENDING: No LinkedIn data available to compare.
`;

export function buildApplicationAnalysisUserPrompt(input: {
  mission: unknown;
  candidate: unknown;
  parsedResume: unknown;
  linkedinVerification: unknown;
  inconsistencies: unknown;
  pipeline?: unknown;
  questions?: unknown;
  responses?: unknown;
}) {
  const parts = [
    "Analyze and return structured JSON.",
    `\nMission:\n${JSON.stringify(input.mission, null, 2)}`,
    `\nCandidate:\n${JSON.stringify(input.candidate, null, 2)}`,
    `\nParsed resume:\n${JSON.stringify(input.parsedResume, null, 2)}`,
    `\nLinkedIn verification:\n${JSON.stringify(input.linkedinVerification, null, 2)}`,
    `\nAlready detected inconsistencies:\n${JSON.stringify(input.inconsistencies, null, 2)}`,
  ];

  if (input.pipeline) {
    parts.push(`\nPipeline:\n${JSON.stringify(input.pipeline, null, 2)}`);
  }
  if (input.questions) {
    parts.push(`\nQuestions:\n${JSON.stringify(input.questions, null, 2)}`);
  }
  if (input.responses) {
    parts.push(`\nResponses:\n${JSON.stringify(input.responses, null, 2)}`);
  }

  return parts.join("\n").trim();
}
