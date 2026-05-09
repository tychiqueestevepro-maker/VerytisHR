import { HR_SYSTEM_PROMPT } from "./system";

/**
 * Pipeline Generation — contextual hiring pipeline.
 *
 * Takes mission, team context, work samples, and generates
 * exercises that mirror real team work without copying confidential data.
 *
 * Most differentiating prompt for inbound value.
 */

export const PIPELINE_GENERATION_SYSTEM = `${HR_SYSTEM_PROMPT}

Generate a contextual hiring pipeline for this mission.

The goal is to evaluate whether a candidate can work in an environment similar to the team they would join.

Use:
- mission description
- role responsibilities
- team context
- manager expectations
- success criteria
- uploaded work samples if provided

The uploaded work samples are examples of the team's real work.
Do not copy them directly.
Do not expose confidential details.
Do not reuse client names, private data, proprietary code, financial numbers, or internal identifiers.

Instead, extract the underlying work pattern:
- type of reasoning required
- technical or business difficulty
- decision-making context
- common mistakes
- expected quality bar
- collaboration constraints
- level of ambiguity

Then generate original exercises that are similar in structure and difficulty, but not identical.

The pipeline must be adapted to the role.

Examples:
- For software roles: include debugging, code review, architecture tradeoff, or small implementation tasks.
- For finance roles: include investment analysis, risk assessment, cash-flow reasoning, market scenario, or portfolio decision.
- For sales roles: include account prioritization, objection handling, discovery reasoning, or outreach personalization.
- For legal/compliance roles: include document analysis, source hierarchy, risk interpretation, or policy reasoning.
- For operations roles: include process improvement, prioritization, coordination, or workflow diagnosis.

Generate a balanced pipeline with the same difficulty level across candidates.
Questions may vary between candidates, but they must test equivalent skills and comparable difficulty.

Return structured JSON matching the provided schema.`;

export function buildPipelineGenerationUserPrompt(input: {
  mission: unknown;
  teamContext?: string;
  successCriteria?: string;
  seniority?: string;
  workSamples?: Array<{ type: string; content: string }>;
}) {
  const parts = [
    "Generate pipeline and return structured JSON.",
    `\nMission:\n${JSON.stringify(input.mission, null, 2)}`,
  ];

  if (input.teamContext) {
    parts.push(`\nTeam context:\n${input.teamContext}`);
  }
  if (input.successCriteria) {
    parts.push(`\nSuccess criteria:\n${input.successCriteria}`);
  }
  if (input.seniority) {
    parts.push(`\nTarget seniority: ${input.seniority}`);
  }
  if (input.workSamples?.length) {
    parts.push(
      `\nWork samples (extract patterns only, do not copy):\n${JSON.stringify(
        input.workSamples,
        null,
        2
      )}`
    );
  }

  return parts.join("\n").trim();
}
