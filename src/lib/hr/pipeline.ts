import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { completeHrJson, HR_CORE_MODEL } from "./openai";
import {
  PIPELINE_GENERATION_SYSTEM,
  buildPipelineGenerationUserPrompt,
  APPLICATION_ANALYSIS_SYSTEM,
  buildApplicationAnalysisUserPrompt,
  PIPELINE_GENERATION_SCHEMA_NAME,
  PipelineGenerationJsonSchema,
  APPLICATION_ANALYSIS_SCHEMA_NAME,
  ApplicationAnalysisJsonSchema,
  PROMPT_VERSIONS,
  SCORING_VERSIONS,
} from "./prompts";
import { computeApplicationFitScore, computeApplicationTeamFitScore, computeApplicationPipelineScore, scoreLevel } from "./scoring";
import { computeAnalysisHash, findCachedAnalysis, storeCachedAnalysis } from "./analysis-cache";
import { asObject, clampScore, pickString, truncateText } from "./utils";

const QUESTION_TYPES = new Set([
  "short_text",
  "long_text",
  "single_choice",
  "multiple_choice",
  "number",
  "date",
  "file",
  "url",
  "yes_no",
  "rating",
]);

const STEP_TYPES = new Set(["application", "screening", "interview", "test", "offer", "custom"]);

function normalizeQuestionType(value: unknown) {
  const candidate = pickString(value)?.toLowerCase();
  return candidate && QUESTION_TYPES.has(candidate) ? candidate : "long_text";
}

function normalizeStepType(value: unknown) {
  const candidate = pickString(value)?.toLowerCase();
  return candidate && STEP_TYPES.has(candidate) ? candidate : "custom";
}

function fallbackPipeline(mission: Record<string, unknown>) {
  const title = pickString(mission.title) || "Mission";
  return {
    name: `${title} contextual pipeline`,
    description: `Contextual assessment pipeline for ${title}.`,
    steps: [
      {
        name: "Mission fit",
        description: "Assess motivation and context understanding.",
        step_type: "screening",
        questions: [
          {
            question_type: "long_text",
            label: `Why is this ${title} mission a strong fit for your recent experience?`,
            description: "Ask for concrete examples from recent roles.",
            placeholder: "Share 2-3 specific examples.",
            options: [],
            is_required: true,
            scoring_weight: 25,
            validation_rules: { min_words: 80 },
          },
          {
            question_type: "long_text",
            label: "Describe a similar challenge you solved and the outcome.",
            description: "Prioritize measurable outcomes.",
            placeholder: "Context, action, result.",
            options: [],
            is_required: true,
            scoring_weight: 30,
            validation_rules: { min_words: 100 },
          },
        ],
      },
      {
        name: "Practical case",
        description: "Assess role-specific reasoning.",
        step_type: "test",
        questions: [
          {
            question_type: "long_text",
            label: "How would you approach your first 30 days in this role?",
            description: "Evaluate prioritization, communication and delivery plan.",
            placeholder: "Structure your answer by week or milestone.",
            options: [],
            is_required: true,
            scoring_weight: 45,
            validation_rules: { min_words: 120 },
          },
        ],
      },
    ],
  };
}

async function generatePipelineSpec(companyId: string, mission: Record<string, unknown>) {
  const model = HR_CORE_MODEL;
  const inputHash = computeAnalysisHash({
    missionData: mission,
    profileData: null,
    linkedinData: null,
    promptVersion: PROMPT_VERSIONS.pipeline_generation,
    scoringVersion: "v1",
    model,
  });

  const cached = await findCachedAnalysis({
    companyId,
    inputHash,
    analysisType: "pipeline_generation",
  });
  if (cached) {
    return { model, spec: asObject(cached.result) };
  }

  const ai = await completeHrJson({
    companyId,
    system: PIPELINE_GENERATION_SYSTEM,
    user: buildPipelineGenerationUserPrompt({ mission }),
    schema: PipelineGenerationJsonSchema,
    schemaName: PIPELINE_GENERATION_SCHEMA_NAME,
  });

  const spec = ai?.data ?? fallbackPipeline(mission);

  await storeCachedAnalysis({
    companyId,
    inputHash,
    analysisType: "pipeline_generation",
    result: spec,
    promptVersion: PROMPT_VERSIONS.pipeline_generation,
    scoringVersion: "v1",
    model: ai?.model ?? model,
  });

  return {
    model: ai?.model ?? "heuristic",
    spec,
  };
}

export async function createMissionPipeline(input: {
  companyId: string;
  applicationId: string;
  userId: string;
}) {
  const supabase = createSupabaseServiceClient();
  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("id", input.applicationId)
    .maybeSingle();

  if (missionError) throw new Error(missionError.message || "Unable to load mission");
  if (!mission) throw new Error("Mission not found");

  const { model, spec } = await generatePipelineSpec(input.companyId, asObject(mission));
  const settings = {
    generation_model: model,
    difficulty: pickString(asObject(spec).difficulty),
    evaluation_criteria: Array.isArray(asObject(spec).evaluation_criteria)
      ? asObject(spec).evaluation_criteria
      : [],
  };

  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .insert({
      company_id: input.companyId,
      mission_id: input.applicationId,
      created_by: input.userId,
      name: pickString(asObject(spec).name) || `${pickString(asObject(mission).title) || "Mission"} pipeline`,
      description: pickString(asObject(spec).description),
      status: "active",
      is_default: true,
      settings,
      published_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (pipelineError) throw new Error(pipelineError.message || "Unable to create pipeline");

  const rawSteps = asObject(spec).steps;
  const steps: unknown[] = Array.isArray(rawSteps) ? rawSteps : fallbackPipeline(asObject(mission)).steps;
  const insertedSteps = [];

  for (const [stepIndex, rawStep] of steps.entries()) {
    const step = asObject(rawStep);
    const { data: insertedStep, error: stepError } = await supabase
      .from("pipeline_steps")
      .insert({
        company_id: input.companyId,
        pipeline_id: pipeline.id,
        position: stepIndex,
        name: pickString(step.name) || `Step ${stepIndex + 1}`,
        description: pickString(step.description),
        step_type: normalizeStepType(step.step_type),
        is_required: true,
        settings: {},
      })
      .select("*")
      .single();

    if (stepError) throw new Error(stepError.message || "Unable to create pipeline step");
    insertedSteps.push(insertedStep);

    const questions = Array.isArray(step.questions) ? step.questions : [];
    const rows = questions.slice(0, 10).map((rawQuestion, questionIndex) => {
      const question = asObject(rawQuestion);
      return {
        company_id: input.companyId,
        pipeline_id: pipeline.id,
        step_id: insertedStep.id,
        position: stepIndex * 100 + questionIndex,
        question_type: normalizeQuestionType(question.question_type),
        label: pickString(question.label) || `Question ${questionIndex + 1}`,
        description: pickString(question.description),
        placeholder: pickString(question.placeholder),
        options: Array.isArray(question.options) ? question.options : [],
        is_required: question.is_required !== false,
        scoring_weight: typeof question.scoring_weight === "number" ? question.scoring_weight : 0,
        knockout: question.knockout === true,
        validation_rules: asObject(question.validation_rules),
      };
    });

    if (rows.length > 0) {
      const { error: questionError } = await supabase.from("pipeline_questions").insert(rows);
      if (questionError) throw new Error(questionError.message || "Unable to create pipeline questions");
    }
  }

  return getMissionPipeline(input.companyId, input.applicationId, pipeline.id);
}

export async function getMissionPipeline(companyId: string, applicationId: string, pipelineId?: string) {
  const supabase = createSupabaseServiceClient();
  let pipelineQuery = supabase
    .from("pipelines")
    .select("*")
    .eq("company_id", companyId)
    .eq("mission_id", applicationId);

  if (pipelineId) {
    pipelineQuery = pipelineQuery.eq("id", pipelineId);
  }

  const { data: pipeline, error } = await pipelineQuery
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load pipeline");
  if (!pipeline) return null;

  const [{ data: steps }, { data: questions }] = await Promise.all([
    supabase
      .from("pipeline_steps")
      .select("*")
      .eq("pipeline_id", pipeline.id)
      .order("position", { ascending: true }),
    supabase
      .from("pipeline_questions")
      .select("*")
      .eq("pipeline_id", pipeline.id)
      .order("position", { ascending: true }),
  ]);

  return {
    pipeline,
    steps: steps ?? [],
    questions: questions ?? [],
  };
}

async function loadSessionForAnalysis(token: string) {
  const supabase = createSupabaseServiceClient();
  const { data: session, error } = await supabase
    .from("pipeline_sessions")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load pipeline session");
  if (!session) throw new Error("Session not found");
  return asObject(session);
}

export async function analyzePipelineSession(token: string) {
  const supabase = createSupabaseServiceClient();
  const session = await loadSessionForAnalysis(token);

  if (session.status === "expired" || session.status === "cancelled") {
    throw new Error("Session is no longer active");
  }

  if (session.status !== "submitted" && session.status !== "analyzed") {
    throw new Error("Session must be submitted before analysis");
  }

  const sessionId = pickString(session.id);
  const companyId = pickString(session.company_id);
  const pipelineId = pickString(session.pipeline_id);
  const candidateId = pickString(session.candidate_id);
  if (!sessionId || !companyId || !pipelineId || !candidateId) {
    throw new Error("Invalid pipeline session");
  }

  if (session.status === "analyzed") {
    const { data: existingScore, error: existingScoreError } = await supabase
      .from("pipeline_scores")
      .select("*")
      .eq("pipeline_session_id", sessionId)
      .maybeSingle();

    if (existingScoreError) {
      throw new Error(existingScoreError.message || "Unable to load pipeline score");
    }

    if (existingScore) {
      return {
        pipelineScore: existingScore,
        analyzedAt: pickString(session.analyzed_at) || new Date().toISOString(),
        alreadyAnalyzed: true,
      };
    }
  }

  try {
    const [{ data: pipeline }, { data: mission }, { data: candidate }, { data: questions }, { data: responses }] =
    await Promise.all([
      supabase.from("pipelines").select("*").eq("id", pipelineId).maybeSingle(),
      session.mission_id
        ? supabase.from("missions").select("*").eq("id", session.mission_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("candidates").select("*").eq("id", candidateId).maybeSingle(),
      supabase.from("pipeline_questions").select("*").eq("pipeline_id", pipelineId).order("position", { ascending: true }),
      supabase
        .from("candidate_pipeline_responses")
        .select("*")
        .eq("pipeline_session_id", sessionId)
        .order("created_at", { ascending: true }),
    ]);

  const model = HR_CORE_MODEL;
  const truncatedResponses = truncateText(JSON.stringify(responses, null, 2), 16000);

  const inputHash = computeAnalysisHash({
    missionData: mission,
    profileData: { candidate, responses: truncatedResponses },
    linkedinData: null,
    promptVersion: PROMPT_VERSIONS.application_analysis,
    scoringVersion: SCORING_VERSIONS.pipeline_score,
    model,
  });

  const cached = await findCachedAnalysis({
    companyId,
    inputHash,
    analysisType: "pipeline_session",
  });

  let aiData = cached ? asObject(cached.result) : null;
  let aiModel = cached ? String(cached.model) : null;

  if (!aiData) {
    const ai = await completeHrJson({
      companyId,
      system: APPLICATION_ANALYSIS_SYSTEM,
      user: buildApplicationAnalysisUserPrompt({
        mission,
        candidate,
        parsedResume: null,
        linkedinVerification: null,
        inconsistencies: [],
        pipeline,
        questions,
        responses: truncatedResponses,
      }),
      schema: ApplicationAnalysisJsonSchema,
      schemaName: APPLICATION_ANALYSIS_SCHEMA_NAME,
    });
    aiData = ai?.data ?? null;
    aiModel = ai?.model ?? null;

    if (aiData) {
      await storeCachedAnalysis({
        companyId,
        inputHash,
        analysisType: "pipeline_session",
        result: aiData,
        promptVersion: PROMPT_VERSIONS.application_analysis,
        scoringVersion: SCORING_VERSIONS.pipeline_score,
        model: aiModel ?? model,
      });
    }
  }

  // --- Rule 3: scores computed by backend from 0-5 criteria ---
  const criteriaScores = asObject(aiData?.criteria_scores) as Record<string, number>;
  const currentModel = aiModel ?? "heuristic";
  const computedPipelineScore = computeApplicationPipelineScore(criteriaScores);
  const fitScore = computeApplicationFitScore(criteriaScores);
  const teamFitScore = computeApplicationTeamFitScore(criteriaScores);
  const fallbackScore = responses && Array.isArray(responses) && responses.length > 0 ? 65 : 35;
  const score = computedPipelineScore > 0 ? computedPipelineScore : fallbackScore;
  const level = scoreLevel(score);
  const analysisText = pickString(aiData?.summary) || "Pipeline responses were analyzed with the available mission context.";
  const coherenceStatus = pickString(asObject(aiData?.linkedin_cv_coherence).status) ?? "pending";

  // --- Rule 6: versioning metadata ---
  const versionMeta = {
    prompt_version: PROMPT_VERSIONS.application_analysis,
    scoring_version: SCORING_VERSIONS.pipeline_score,
    model: currentModel,
    temperature: 0,
  };

  const persistedCriteria = {
    criteria_scores: criteriaScores,
    team_fit_score: teamFitScore,
    fit_score: fitScore,
    linkedin_cv_coherence: coherenceStatus,
    strengths: Array.isArray(aiData?.strengths) ? aiData.strengths : [],
    risks: Array.isArray(aiData?.risks) ? aiData.risks : [],
    facts: Array.isArray(aiData?.facts) ? aiData.facts : [],
    inferences: Array.isArray(aiData?.inferences) ? aiData.inferences : [],
    hypotheses: Array.isArray(aiData?.hypotheses) ? aiData.hypotheses : [],
    recommendation: pickString(aiData?.recommendation) ?? "",
    ...versionMeta,
  };

  const { data: pipelineScoreRow, error: scoreError } = await supabase
    .from("pipeline_scores")
    .upsert(
      {
        company_id: companyId,
        pipeline_session_id: sessionId,
        candidate_id: candidateId,
        mission_id: pickString(session.mission_id),
        pipeline_id: pipelineId,
        score,
        level,
        analysis: analysisText,
        criteria: persistedCriteria,
        model_name: model || HR_CORE_MODEL,
      },
      { onConflict: "pipeline_session_id" },
    )
    .select("*")
    .single();

  if (scoreError) throw new Error(scoreError.message || "Unable to save pipeline score");

  const analyzedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("pipeline_sessions")
    .update({
      status: "analyzed",
      analyzed_at: analyzedAt,
    })
    .eq("id", sessionId);

  if (updateError) throw new Error(updateError.message || "Unable to update pipeline session");

  if (session.mission_id) {
    const { data: candidateMission } = await supabase
      .from("candidate_missions")
      .select("id, metadata")
      .eq("company_id", companyId)
      .eq("candidate_id", candidateId)
      .eq("mission_id", session.mission_id)
      .maybeSingle();

    if (candidateMission) {
      await supabase
        .from("candidate_missions")
        .update({
          source_type: "application",
          metadata: {
            ...asObject(candidateMission.metadata),
            team_fit_score: teamFitScore,
            linkedin_cv_coherence: coherenceStatus,
            strengths: persistedCriteria.strengths,
            risks: persistedCriteria.risks,
            recommendation: persistedCriteria.recommendation || null,
            pipeline_score: score,
            criteria_scores: criteriaScores,
            ...versionMeta,
          },
        })
        .eq("id", candidateMission.id);
    }
  }

  return {
    pipelineScore: pipelineScoreRow,
    analyzedAt,
    alreadyAnalyzed: false,
  };
  } catch (error) {
    await supabase
      .from("pipeline_sessions")
      .update({ status: "failed" })
      .eq("id", sessionId)
      .eq("status", "submitted");

    throw error;
  }
}

export async function getMissionPipelineResults(companyId: string, applicationId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: sessions, error } = await supabase
    .from("pipeline_sessions")
    .select("*")
    .eq("company_id", companyId)
    .eq("mission_id", applicationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message || "Unable to load pipeline sessions");

  const sessionRows = Array.isArray(sessions) ? sessions : [];
  const candidateIds = sessionRows.map((session) => String(asObject(session).candidate_id)).filter(Boolean);

  const { data: candidateMissions, error: candidateMissionError } = candidateIds.length
    ? await supabase
        .from("candidate_missions")
        .select("*")
        .eq("company_id", companyId)
        .eq("mission_id", applicationId)
        .eq("source_type", "application")
        .in("candidate_id", candidateIds)
    : { data: [], error: null };

  if (candidateMissionError) {
    throw new Error(candidateMissionError.message || "Unable to load application relations");
  }

  const candidateMissionsByCandidate = new Map(
    (Array.isArray(candidateMissions) ? candidateMissions : []).map((candidateMission) => [
      String(asObject(candidateMission).candidate_id),
      candidateMission,
    ]),
  );
  const applicationSessions = sessionRows.filter((session) => candidateMissionsByCandidate.has(String(asObject(session).candidate_id)));
  const sessionIds = applicationSessions.map((session) => String(asObject(session).id)).filter(Boolean);
  const applicationCandidateIds = applicationSessions.map((session) => String(asObject(session).candidate_id)).filter(Boolean);

  const [{ data: scores }, { data: candidates }] = await Promise.all([
    sessionIds.length
      ? supabase.from("pipeline_scores").select("*").in("pipeline_session_id", sessionIds)
      : Promise.resolve({ data: [] }),
    applicationCandidateIds.length
      ? supabase.from("candidates").select("id, first_name, last_name, email, linkedin_url, current_title, current_company_name").in("id", applicationCandidateIds)
      : Promise.resolve({ data: [] }),
  ]);

  const scoresBySession = new Map(
    (Array.isArray(scores) ? scores : []).map((score) => [String(asObject(score).pipeline_session_id), score]),
  );
  const candidatesById = new Map(
    (Array.isArray(candidates) ? candidates : []).map((candidateRow) => [String(asObject(candidateRow).id), candidateRow]),
  );

  return applicationSessions.map((session) => {
    const row = asObject(session);
    return {
      session,
      candidate: candidatesById.get(String(row.candidate_id)) ?? null,
      candidateMission: candidateMissionsByCandidate.get(String(row.candidate_id)) ?? null,
      score: scoresBySession.get(String(row.id)) ?? null,
    };
  });
}
