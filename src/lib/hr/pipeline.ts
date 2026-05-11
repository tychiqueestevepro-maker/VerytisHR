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
import { asObject, pickNumber, pickString, truncateText } from "./utils";
import { getMissionWorkSamples, workSamplePromptItems } from "./work-samples";
import { scrapeLinkedInProfile, parseLinkedInProfile, formatScrapedDataForVerification } from "./scraper/linkedin";

const QUESTION_TYPES = new Set([
  "short_text",
  "short_answer",
  "long_text",
  "written_answer",
  "single_choice",
  "multiple_choice",
  "scenario",
  "prioritization",
  "problem_solving",
  "number",
  "date",
  "file",
  "url",
  "yes_no",
  "rating",
]);

const STEP_TYPES = new Set(["application", "screening", "interview", "test", "offer", "custom"]);
const PRODUCT_QUESTION_TYPES = new Set([
  "multiple_choice",
  "short_answer",
  "written_answer",
  "scenario",
  "prioritization",
  "problem_solving",
]);
const ANTI_CHEAT_LEVELS = new Set(["low", "medium", "high"]);

function normalizeQuestionFormat(value: unknown) {
  const candidate = pickString(value)?.toLowerCase().replace(/-/g, "_");
  if (!candidate) return null;
  if (PRODUCT_QUESTION_TYPES.has(candidate)) return candidate;
  if (candidate === "short_text") return "short_answer";
  if (candidate === "long_text" || candidate === "role_specific_task") return "written_answer";
  if (candidate === "single_choice") return "multiple_choice";
  if (candidate === "prioritization_exercise" || candidate === "account_prioritization") return "prioritization";
  if (
    candidate === "code_debugging" ||
    candidate === "code_review" ||
    candidate === "architecture_decision" ||
    candidate === "financial_case" ||
    candidate === "risk_assessment"
  ) {
    return "problem_solving";
  }
  if (candidate === "discovery_scenario" || candidate === "objection_handling") return "scenario";
  return null;
}

function normalizeQuestionType(value: unknown) {
  const candidate = pickString(value)?.toLowerCase();
  const format = normalizeQuestionFormat(candidate);
  if (format) return format;
  return candidate && QUESTION_TYPES.has(candidate) ? candidate : "long_text";
}

function normalizeStepType(value: unknown) {
  const candidate = pickString(value)?.toLowerCase();
  return candidate && STEP_TYPES.has(candidate) ? candidate : "custom";
}

function normalizeAntiCheatLevel(value: unknown, requiresReasoning: boolean) {
  const candidate = pickString(value)?.toLowerCase();
  if (candidate && ANTI_CHEAT_LEVELS.has(candidate)) return candidate;
  return requiresReasoning ? "medium" : "low";
}

function normalizeTimeLimitSeconds(question: Record<string, unknown>, fallback = 180) {
  const seconds = pickNumber(question.time_limit_seconds);
  if (seconds) return Math.min(1200, Math.max(30, Math.round(seconds)));

  const minutes = pickNumber(question.estimated_time_minutes);
  if (minutes) return Math.min(1200, Math.max(30, Math.round(minutes * 60)));

  return fallback;
}

function questionValidationRules(question: Record<string, unknown>) {
  const existingRules = asObject(question.validation_rules);
  const format = normalizeQuestionFormat(question.question_type) ?? normalizeQuestionFormat(existingRules.question_type) ?? "written_answer";
  const requiresReasoning = question.requires_reasoning === true || existingRules.requires_reasoning === true || (
    format !== "short_answer" && format !== "multiple_choice"
  );
  const timeLimitSeconds = normalizeTimeLimitSeconds(question);
  const points = Math.min(100, Math.max(1, Math.round(pickNumber(question.points) ?? pickNumber(question.scoring_weight) ?? 10)));

  return {
    ...existingRules,
    question_type: format,
    time_limit_seconds: timeLimitSeconds,
    points,
    requires_reasoning: requiresReasoning,
    anti_cheat_level: normalizeAntiCheatLevel(question.anti_cheat_level, requiresReasoning),
    context: pickString(question.context),
    skill_tested: pickString(question.skill_tested),
    difficulty: pickString(question.difficulty),
    evaluation_criteria: Array.isArray(question.evaluation_criteria) ? question.evaluation_criteria : [],
    expected_good_answer_signals: Array.isArray(question.expected_good_answer_signals) ? question.expected_good_answer_signals : [],
    red_flags: Array.isArray(question.red_flags) ? question.red_flags : [],
  };
}

function fallbackPipeline(mission: Record<string, unknown>) {
  const title = pickString(mission.title) || "Mission";
  return {
    name: `${title} contextual pipeline`,
    description: `Contextual assessment pipeline for ${title}.`,
    steps: [
      {
        name: "Quick reasoning",
        description: "Assess fast comprehension and concise judgment.",
        step_type: "screening",
        questions: [
          {
            question_type: "multiple_choice",
            time_limit_seconds: 60,
            points: 10,
            requires_reasoning: false,
            anti_cheat_level: "low",
            label: `What is the most important first signal of success for this ${title} mission?`,
            description: "Choose the best answer based on the role context.",
            placeholder: "",
            options: ["Speed of activity", "Relevant outcome quality", "Number of meetings", "Seniority title match"],
            is_required: true,
            scoring_weight: 10,
            validation_rules: {},
          },
          {
            question_type: "short_answer",
            time_limit_seconds: 120,
            points: 10,
            requires_reasoning: true,
            anti_cheat_level: "medium",
            label: "Give one concrete example that shows you can handle this role context.",
            description: "Keep the answer concise and specific.",
            placeholder: "Situation, action, outcome.",
            options: [],
            is_required: true,
            scoring_weight: 10,
            validation_rules: { min_words: 40, max_words: 120 },
          },
        ],
      },
      {
        name: "Contextual case",
        description: "Assess role-specific reasoning under realistic constraints.",
        step_type: "test",
        questions: [
          {
            question_type: "prioritization",
            time_limit_seconds: 300,
            points: 15,
            requires_reasoning: true,
            anti_cheat_level: "medium",
            label: "Prioritize these first-week actions and justify your order.",
            description: "Rank the actions from highest to lowest impact.",
            placeholder: "1. ... because ...",
            options: ["Clarify success metrics", "Review past work samples", "Meet stakeholders", "Ship a quick visible win"],
            is_required: true,
            scoring_weight: 15,
            validation_rules: { min_words: 80 },
          },
          {
            question_type: "scenario",
            time_limit_seconds: 240,
            points: 15,
            requires_reasoning: true,
            anti_cheat_level: "medium",
            label: "A teammate disagrees with your proposed next step. How do you handle it?",
            description: "Evaluate communication, judgment and collaboration.",
            placeholder: "Explain your response and decision process.",
            options: [],
            is_required: true,
            scoring_weight: 15,
            validation_rules: { min_words: 80 },
          },
          {
            question_type: "problem_solving",
            time_limit_seconds: 360,
            points: 20,
            requires_reasoning: true,
            anti_cheat_level: "high",
            label: "Solve this short case: the team is behind target and has limited context. What do you do first?",
            description: "Evaluate structured thinking and decision quality.",
            placeholder: "State assumptions, decision, tradeoffs and next action.",
            options: [],
            is_required: true,
            scoring_weight: 20,
            validation_rules: { min_words: 120 },
          },
        ],
      },
    ],
  };
}

async function generatePipelineSpec(companyId: string, mission: Record<string, unknown>) {
  const model = HR_CORE_MODEL;
  const missionMeta = asObject(mission.metadata);
  const missionId = pickString(mission.id);
  const storedWorkSamples = missionId
    ? workSamplePromptItems(await getMissionWorkSamples({ companyId, missionId }))
    : [];
  const workSampleText = pickString(missionMeta.work_samples, missionMeta.real_team_material);
  const workSamples = storedWorkSamples.length
    ? storedWorkSamples
    : workSampleText
      ? [{ type: "real_team_material", content: workSampleText }]
      : [];
  const questionTypes = Array.isArray(missionMeta.question_types)
    ? missionMeta.question_types.map((type) => normalizeQuestionFormat(type) ?? String(type)).filter(Boolean)
    : [];
  const inputHash = computeAnalysisHash({
    missionData: mission,
    profileData: { workSamples },
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
    user: buildPipelineGenerationUserPrompt({
      mission,
      teamContext: pickString(missionMeta.team_context, mission.department) ?? undefined,
      successCriteria: pickString(missionMeta.success_criteria) ?? undefined,
      seniority: pickString(missionMeta.seniority) ?? undefined,
      numberOfQuestions: pickNumber(missionMeta.number_of_questions),
      estimatedTimeMinutes: pickNumber(missionMeta.estimated_time_minutes),
      questionTypes: Array.isArray(questionTypes) ? questionTypes : undefined,
      workSamples,
    } as any),
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
  userId?: string | null;
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

  const missionMeta = asObject(asObject(mission).metadata);
  const requestedQuestionCount = Math.min(12, Math.max(1, Math.round(pickNumber(missionMeta.number_of_questions) ?? 10)));
  const requestedEstimatedTime = pickNumber(missionMeta.estimated_time_minutes);
  const requestedQuestionTypes = Array.isArray(missionMeta.question_types)
    ? missionMeta.question_types.map((type) => normalizeQuestionFormat(type) ?? String(type)).filter(Boolean)
    : [];
  const { model, spec } = await generatePipelineSpec(input.companyId, asObject(mission));
  const settings = {
    generation_model: model,
    difficulty: pickString(asObject(spec).difficulty),
    requested_number_of_questions: requestedQuestionCount,
    requested_estimated_time_minutes: requestedEstimatedTime,
    requested_question_types: requestedQuestionTypes,
    generated_estimated_total_time_minutes: pickNumber(asObject(spec).estimated_total_time_minutes),
    evaluation_criteria: Array.isArray(asObject(spec).evaluation_criteria)
      ? asObject(spec).evaluation_criteria
      : [],
  };

  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .insert({
      company_id: input.companyId,
      mission_id: input.applicationId,
      created_by: input.userId ?? null,
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
  let remainingQuestions = requestedQuestionCount;

  for (const [stepIndex, rawStep] of steps.entries()) {
    if (remainingQuestions <= 0) break;

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
    const rows = questions.slice(0, remainingQuestions).map((rawQuestion, questionIndex) => {
      const question = asObject(rawQuestion);
      const validationRules = questionValidationRules(question);
      return {
        company_id: input.companyId,
        pipeline_id: pipeline.id,
        step_id: insertedStep.id,
        position: stepIndex * 100 + questionIndex,
        question_type: normalizeQuestionType(validationRules.question_type),
        label: pickString(question.label) || `Question ${questionIndex + 1}`,
        description: pickString(question.description),
        placeholder: pickString(question.placeholder),
        options: Array.isArray(question.options) ? question.options : [],
        is_required: question.is_required !== false,
        scoring_weight: pickNumber(question.points) ?? pickNumber(question.scoring_weight) ?? 0,
        knockout: question.knockout === true,
        validation_rules: validationRules,
      };
    });

    if (rows.length > 0) {
      const { error: questionError } = await supabase.from("pipeline_questions").insert(rows);
      if (questionError) throw new Error(questionError.message || "Unable to create pipeline questions");
      remainingQuestions -= rows.length;
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

async function loadSessionForAnalysis(sessionIdOrToken: string) {
  const supabase = createSupabaseServiceClient();
  const { data: session, error } = await supabase
    .from("pipeline_sessions")
    .select("*")
    .or(`id.eq.${sessionIdOrToken},public_token.eq.${sessionIdOrToken}`)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load pipeline session");
  if (!session) throw new Error("Session not found");
  return asObject(session);
}

export async function analyzePipelineSession(sessionIdOrToken: string) {
  const supabase = createSupabaseServiceClient();
  const session = await loadSessionForAnalysis(sessionIdOrToken);

  if (session.status === "expired" || session.status === "cancelled") {
    throw new Error("Session is no longer active");
  }

  if (
    session.status !== "submitted" &&
    session.status !== "completed" &&
    session.status !== "flagged" &&
    session.status !== "analyzed"
  ) {
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
    const [
      pipelineResponse,
      missionResponse,
      candidateResponse,
      questionsResponse,
      responsesResponse,
      resumeResponse,
      linkedinResponse,
      inconsistenciesResponse,
    ] = await Promise.all([
      supabase.from("pipelines").select("*").eq("id", pipelineId).maybeSingle(),
      session.mission_id
        ? supabase.from("missions").select("*").eq("id", session.mission_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("candidates").select("*").eq("id", candidateId).maybeSingle(),
      supabase.from("pipeline_questions").select("*").eq("pipeline_id", pipelineId).order("position", { ascending: true }),
      supabase.from("candidate_pipeline_responses").select("*").eq("pipeline_session_id", sessionId).order("created_at", { ascending: true }),
      supabase.from("candidate_documents").select("*").eq("candidate_id", candidateId).eq("status", "parsed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("linkedin_verifications").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("candidate_inconsistencies").select("*").eq("candidate_id", candidateId),
    ]);

    const pipeline = pipelineResponse.data;
    const mission = missionResponse.data;
    const candidate = candidateResponse.data;
    const questions = questionsResponse.data;
    const responses = responsesResponse.data;
    const resume = resumeResponse.data;
    let linkedin = linkedinResponse.data;
    const inconsistencies = inconsistenciesResponse.data ?? [];

    // --- Automated LinkedIn Scraper Integration with 30-day expiration ---
    const CACHE_EXPIRATION_DAYS = 30;
    const isExpired = linkedin && (
      new Date().getTime() - new Date(pickString(linkedin.created_at) || 0).getTime() > CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
    );

    const effectiveLinkedinUrl = pickString(session.candidate_linkedin_url) || pickString(candidate?.linkedin_url);
    
    // 1. On récupère le compte LinkedIn configuré pour cette entreprise
    const { data: linkedinAccount } = await supabase
      .from("linkedin_accounts")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "connected")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: linkedinSession } = linkedinAccount 
      ? await supabase
          .from("linkedin_sessions")
          .select("*")
          .eq("account_id", linkedinAccount.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    // Legacy fallback (to be removed in Phase 3 migration)
    const { data: companyRecord } = await supabase.from("companies").select("metadata").eq("id", companyId).maybeSingle();
    const companyMetadata = asObject(companyRecord?.metadata);
    const cachedHtml = pickString(companyMetadata.last_scraped_html);
    const legacyCookie = pickString(companyMetadata.linkedin_session_cookie);

    let scrapedProfile = null;

    if ((!linkedin || isExpired) && effectiveLinkedinUrl) {
      console.log(`[Analysis] Checking for cached HTML for URL: ${effectiveLinkedinUrl}`);
      
      const extractLinkedinUsername = (url: string) => {
        const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
        return match ? match[1] : null;
      };

      if (cachedHtml && effectiveLinkedinUrl.includes(extractLinkedinUsername(effectiveLinkedinUrl) || "")) {
        console.log(`[Analysis] Using direct HTML from extension! Skipping Puppeteer.`);
        scrapedProfile = await parseLinkedInProfile(cachedHtml);
      } else if (linkedinSession || legacyCookie) {
        console.log(`[Analysis] Session found: ${!!linkedinSession || !!legacyCookie}`);
        console.log(`[Analysis] Triggering scraper for URL: ${effectiveLinkedinUrl}`);
        
        try {
          scrapedProfile = await scrapeLinkedInProfile(
            effectiveLinkedinUrl, 
            linkedinSession?.session_data || legacyCookie,
            linkedinAccount?.proxy_config
          );
        } catch (scraperError: any) {
          console.error(`[Analysis] Scraper CRASHED: ${scraperError.message}`);
          await supabase.from("linkedin_verifications").upsert({
            company_id: companyId,
            candidate_id: candidateId,
            linkedin_url: effectiveLinkedinUrl,
            status: "error",
            verification_data: { error: `Scraper crashed: ${scraperError.message}` }
          }, { onConflict: "candidate_id" });
        }
      }
      
      if (!scrapedProfile) {
        console.warn(`[Analysis] LinkedIn scraper returned NULL for ${effectiveLinkedinUrl}`);
        await supabase
          .from("linkedin_verifications")
          .upsert({
            company_id: companyId,
            candidate_id: candidateId,
            linkedin_url: effectiveLinkedinUrl,
            status: "error",
            verification_data: { error: "Automated scrape returned no data" }
          }, { onConflict: "candidate_id" });
      } else {
        console.log(`[Analysis] Scraper success for ${effectiveLinkedinUrl}. Updating DB...`);
        const verificationData = formatScrapedDataForVerification(scrapedProfile);
        
        const { data: newLinkedin, error: upsertError } = await supabase
          .from("linkedin_verifications")
          .upsert({
            company_id: companyId,
            candidate_id: candidateId,
            linkedin_url: effectiveLinkedinUrl,
            ...verificationData,
            status: "verified",
            checked_at: new Date().toISOString()
          }, { onConflict: "candidate_id" })
          .select("*")
          .maybeSingle();
        
        if (upsertError) console.error(`[Analysis] Upsert error (success scrape): ${upsertError.message}`);
        if (newLinkedin) {
          linkedin = newLinkedin;
          console.log("[Analysis] LinkedIn cache updated successfully.");
        }
      }
    }

    console.log(`[Analysis] Preparing AI analysis. LinkedIn data present: ${!!linkedin}`);

    const model = HR_CORE_MODEL;
    const truncatedResponses = truncateText(JSON.stringify(responses, null, 2), 16000);

  const inputHash = computeAnalysisHash({
    missionData: mission,
    profileData: { candidate, responses: truncatedResponses },
    linkedinData: linkedin,
    resumeData: resume,
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
        parsedResume: resume,
        linkedinVerification: linkedin,
        inconsistencies: inconsistencies,
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
      .in("status", ["submitted", "completed", "flagged"]);

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
