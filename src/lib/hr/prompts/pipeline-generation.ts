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

Use a mix of assessment formats. The goal is not to prevent every possible cheat.
The goal is to make the test closer to the candidate's real reasoning under realistic constraints.

Allowed question_type values:
- multiple_choice
- short_answer
- written_answer
- scenario
- prioritization
- problem_solving

Every question must include:
- question_type
- time_limit_seconds
- points
- requires_reasoning
- anti_cheat_level: low, medium, or high

Design rules:
- Include quick timed questions when useful: 45-120 seconds.
- Use multiple choice for fast comprehension, buyer selection, next-step selection, or risk detection.
- Use short_answer for concise constrained answers.
- Use scenario for realistic team or client situations.
- Use prioritization for ranking accounts, tasks, bugs, risks, tickets, cases, or tradeoffs.
- Use problem_solving for a short case requiring a decision and justification.
- If a multiple-choice question tests judgment, set requires_reasoning to true and ask for a short justification.
- Keep total estimated time close to the requested completion time.
- Points should reflect difficulty and importance. Use 5-20 points per question.

Examples:
- For software roles: include debugging, code review, architecture tradeoff, or small implementation tasks.
- For finance roles: include investment analysis, risk assessment, cash-flow reasoning, market scenario, or portfolio decision.
- For sales roles: include account prioritization, objection handling, discovery reasoning, or outreach personalization.
- For legal/compliance roles: include document analysis, source hierarchy, risk interpretation, or policy reasoning.
- For operations roles: include process improvement, prioritization, coordination, or workflow diagnosis.

Example sales mix:
- Prioritize 4 accounts: prioritization, 300 seconds, tests commercial reasoning.
- Identify the right buyer: multiple_choice, 60 seconds, tests quick understanding.
- Write an outbound message: short_answer, 240 seconds, tests clarity and personalization.
- Respond to an objection: scenario, 240 seconds, tests commercial reflexes.
- Choose the next follow-up and justify it: multiple_choice, 120 seconds, tests CRM discipline.
- Resolve a short account case: problem_solving, 360 seconds, tests logic and decision quality.

Generate a balanced pipeline with the same difficulty level across candidates.
Questions may vary between candidates, but they must test equivalent skills and comparable difficulty.

Return structured JSON matching the provided schema.`;

export function buildPipelineGenerationUserPrompt(input: {
  mission: unknown;
  teamContext?: string;
  successCriteria?: string;
  seniority?: string;
  numberOfQuestions?: number | null;
  estimatedTimeMinutes?: number | null;
  questionTypes?: string[];
  workSamples?: Array<{ type: string; content: string; fileName?: string | null }>;
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
  if (input.numberOfQuestions || input.estimatedTimeMinutes || input.questionTypes?.length) {
    parts.push(`\nPipeline settings:\n${JSON.stringify({
      number_of_questions: input.numberOfQuestions ?? null,
      estimated_time_minutes: input.estimatedTimeMinutes ?? null,
      requested_question_types: input.questionTypes ?? [],
      default_question_types_if_missing: [
        "multiple_choice",
        "short_answer",
        "written_answer",
        "scenario",
        "prioritization",
        "problem_solving",
      ],
    }, null, 2)}`);
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
