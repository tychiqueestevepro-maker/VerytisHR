import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { asObject, pickNumber, pickString } from "./utils";

type PipelineSessionStatus =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed"
  | "incomplete"
  | "flagged"
  | "opened"
  | "submitted"
  | "analyzed"
  | "failed"
  | "expired"
  | "cancelled";

type PipelineSessionRow = Record<string, unknown> & {
  id: string;
  company_id: string;
  candidate_id: string;
  mission_id: string | null;
  pipeline_id: string;
  public_token: string;
  status: PipelineSessionStatus;
  expires_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  analyzed_at: string | null;
  candidate_email: string | null;
  candidate_name: string | null;
  metadata: Record<string, unknown>;
};

type PipelineQuestionRow = {
  id: string;
  step_id: string | null;
  position: number;
  question_type: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  options: unknown[];
  is_required: boolean;
  validation_rules: Record<string, unknown>;
};

type PipelineStepRow = {
  id: string;
  position: number;
  name: string;
  description: string | null;
  step_type: string;
  is_required: boolean;
};

export type PipelineSessionResponseInput = {
  questionId: string;
  responseText?: string | null;
  responseJson?: Record<string, unknown> | unknown[];
  fileDocumentId?: string | null;
  status?: "locked" | "timed_out" | "draft";
};

export type PipelineSessionEventInput = {
  questionId?: string | null;
  eventType: string;
  eventData?: Record<string, unknown>;
};

export type StartPipelineSessionInput = {
  email: string;
  linkedinUrl: string;
};

export type CreatePipelineSessionInput = {
  companyId: string;
  candidateId: string;
  pipelineId: string;
  applicationId?: string | null;
  candidateEmail?: string | null;
  candidateName?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

const ACTIVE_SESSION_STATUSES = ["opened", "not_started", "in_progress", "paused"];
const CLOSED_SESSION_STATUSES = new Set(["completed", "submitted", "analyzed", "cancelled", "expired", "failed", "incomplete"]);
const LOCKED_RESPONSE_STATUSES = new Set(["submitted", "locked", "timed_out", "reviewed", "flagged"]);
const COPY_EVENTS = new Set(["paste_attempt", "copy_attempt", "cut_attempt", "context_menu_opened", "drag_drop_attempt"]);
const FOCUS_EVENTS = new Set(["tab_blur"]);

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

async function findActivePipelineSession(
  supabase: SupabaseServiceClient,
  candidateId: string,
  pipelineId: string,
) {
  const { data, error } = await supabase
    .from("pipeline_sessions")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("pipeline_id", pipelineId)
    .in("status", ACTIVE_SESSION_STATUSES)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load existing pipeline session");
  }

  return data as PipelineSessionRow | null;
}

function isExpired(session: PipelineSessionRow) {
  return Boolean(session.expires_at && new Date(session.expires_at).getTime() < Date.now());
}

function globalTimeExpired(session: PipelineSessionRow) {
  const startedAt = pickString(session.started_at);
  const limitMinutes = pickNumber(session.time_limit_minutes);
  if (!startedAt || !limitMinutes) return false;
  return Date.now() > new Date(startedAt).getTime() + limitMinutes * 60 * 1000;
}

function assertUuidToken(token: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    throw new Error("Invalid session token");
  }
}

function normalizeUrl(value: string | null) {
  return value?.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/g, "").toLowerCase() ?? null;
}

function responseIsLocked(response: Record<string, unknown> | null | undefined) {
  if (!response) return false;
  const status = pickString(response.status);
  return response.is_locked === true || Boolean(status && LOCKED_RESPONSE_STATUSES.has(status));
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const number = pickNumber(value);
    if (number !== null) return number;
  }

  return null;
}

function firstUnlockedQuestionIndex(questions: PipelineQuestionRow[], responses: Record<string, unknown>[]) {
  const lockedQuestionIds = new Set(
    responses
      .filter(responseIsLocked)
      .map((response) => pickString(response.question_id))
      .filter((id): id is string => Boolean(id)),
  );
  const index = questions.findIndex((question) => !lockedQuestionIds.has(question.id));
  return index === -1 ? questions.length : index;
}

function sessionTimeLimitMinutes(session: PipelineSessionRow, pipeline: unknown, mission: unknown) {
  const pipelineSettings = asObject(asObject(pipeline).settings);
  const missionMeta = asObject(asObject(mission).metadata);
  return Math.round(
    firstNumber(
      session.time_limit_minutes,
      pipelineSettings.generated_estimated_total_time_minutes,
      pipelineSettings.requested_estimated_time_minutes,
      missionMeta.estimated_time_minutes,
    ) ?? 25,
  );
}

async function insertSessionEvent(input: {
  supabase: SupabaseServiceClient;
  session: PipelineSessionRow;
  questionId?: string | null;
  eventType: string;
  eventData?: Record<string, unknown>;
}) {
  const { error } = await input.supabase
    .from("pipeline_session_events")
    .insert({
      company_id: input.session.company_id,
      pipeline_session_id: input.session.id,
      question_id: input.questionId ?? null,
      event_type: input.eventType,
      event_data: input.eventData ?? {},
    });

  if (error) throw new Error(error.message || "Unable to log session event");
}

async function activeOrThrow(supabase: SupabaseServiceClient, session: PipelineSessionRow) {
  if (isExpired(session)) {
    await supabase.from("pipeline_sessions").update({ status: "expired" }).eq("id", session.id);
    throw new Error("Session is no longer active");
  }
  if (globalTimeExpired(session)) {
    await supabase
      .from("pipeline_sessions")
      .update({
        status: "incomplete",
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", session.id);
    throw new Error("Session time limit reached");
  }
  if (CLOSED_SESSION_STATUSES.has(session.status)) {
    throw new Error(session.status === "completed" || session.status === "submitted" || session.status === "analyzed"
      ? "Session already completed"
      : "Session is no longer active");
  }
}

export async function createPipelineSession(input: CreatePipelineSessionInput) {
  const supabase = createSupabaseServiceClient();
  const existingSession = await findActivePipelineSession(supabase, input.candidateId, input.pipelineId);
  if (existingSession && !isExpired(existingSession)) {
    return existingSession;
  }

  if (existingSession) {
    await supabase
      .from("pipeline_sessions")
      .update({ status: "expired" })
      .eq("id", existingSession.id);
  }

  const { data, error } = await supabase
    .from("pipeline_sessions")
    .insert({
      company_id: input.companyId,
      candidate_id: input.candidateId,
      mission_id: input.applicationId ?? null,
      pipeline_id: input.pipelineId,
      status: "not_started",
      candidate_email: input.candidateEmail ?? null,
      candidate_name: input.candidateName ?? null,
      expires_at: input.expiresAt ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const concurrentSession = await findActivePipelineSession(supabase, input.candidateId, input.pipelineId);
      if (concurrentSession) return concurrentSession;
    }

    throw new Error(error.message || "Unable to create pipeline session");
  }

  return data as PipelineSessionRow;
}

export async function getPipelineSessionByToken(token: string) {
  assertUuidToken(token);

  const supabase = createSupabaseServiceClient();
  const { data: session, error: sessionError } = await supabase
    .from("pipeline_sessions")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message || "Unable to load pipeline session");
  }

  if (!session) {
    return null;
  }

  const typedSession = session as PipelineSessionRow;
  if (isExpired(typedSession) && typedSession.status !== "expired") {
    await supabase
      .from("pipeline_sessions")
      .update({ status: "expired" })
      .eq("id", typedSession.id);

    typedSession.status = "expired";
  }

  const [{ data: pipeline }, { data: steps }, { data: questions }, { data: mission }, { data: responses }] = await Promise.all([
    supabase
      .from("pipelines")
      .select("id, name, description, status, mission_id, settings")
      .eq("id", typedSession.pipeline_id)
      .maybeSingle(),
    supabase
      .from("pipeline_steps")
      .select("id, position, name, description, step_type, is_required")
      .eq("pipeline_id", typedSession.pipeline_id)
      .order("position", { ascending: true }),
    supabase
      .from("pipeline_questions")
      .select("id, step_id, position, question_type, label, description, placeholder, options, is_required, validation_rules")
      .eq("pipeline_id", typedSession.pipeline_id)
      .order("position", { ascending: true }),
    typedSession.mission_id
      ? supabase
          .from("missions")
          .select("id, title, department, location, description, metadata")
          .eq("id", typedSession.mission_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("candidate_pipeline_responses")
      .select("*")
      .eq("pipeline_session_id", typedSession.id)
      .order("created_at", { ascending: true }),
  ]);

  return {
    session: typedSession,
    pipeline,
    mission,
    application: mission,
    steps: (steps ?? []) as PipelineStepRow[],
    questions: (questions ?? []) as PipelineQuestionRow[],
    responses: Array.isArray(responses) ? (responses as Record<string, unknown>[]) : [],
  };
}

export async function identifyAndStartPipelineSession(token: string, input: StartPipelineSessionInput) {
  const email = pickString(input.email)?.toLowerCase();
  const linkedinUrl = pickString(input.linkedinUrl);
  if (!email) throw new Error("Email is required");
  if (!linkedinUrl) throw new Error("LinkedIn URL is required");

  const data = await getPipelineSessionByToken(token);
  if (!data) throw new Error("Session not found");

  const supabase = createSupabaseServiceClient();
  const session = data.session;
  await activeOrThrow(supabase, session);

  const { data: candidate } = await supabase
    .from("candidates")
    .select("id, email, linkedin_url")
    .eq("id", session.candidate_id)
    .eq("company_id", session.company_id)
    .maybeSingle();

  const flagReasons = [
    pickString(session.candidate_email) && pickString(session.candidate_email)?.toLowerCase() !== email
      ? "different email used to resume session"
      : null,
    normalizeUrl(pickString(session.candidate_linkedin_url)) && normalizeUrl(pickString(session.candidate_linkedin_url)) !== normalizeUrl(linkedinUrl)
      ? "different LinkedIn URL used to resume session"
      : null,
    normalizeUrl(pickString(asObject(candidate).linkedin_url)) && normalizeUrl(pickString(asObject(candidate).linkedin_url)) !== normalizeUrl(linkedinUrl)
      ? "LinkedIn URL differs from candidate profile"
      : null,
    pickString(asObject(candidate).email) && pickString(asObject(candidate).email)?.toLowerCase() !== email
      ? "email differs from candidate profile"
      : null,
  ].filter((reason): reason is string => Boolean(reason));

  const now = new Date().toISOString();
  const timeLimitMinutes = sessionTimeLimitMinutes(session, data.pipeline, data.mission);
  const currentIndex = firstUnlockedQuestionIndex(data.questions, data.responses);
  const { error: updateError } = await supabase
    .from("pipeline_sessions")
    .update({
      status: "in_progress",
      candidate_email: email,
      candidate_linkedin_url: linkedinUrl,
      started_at: session.started_at ?? now,
      last_seen_at: now,
      current_question_index: currentIndex,
      total_questions: data.questions.length,
      time_limit_minutes: timeLimitMinutes,
      is_flagged: session.is_flagged === true || flagReasons.length > 0,
      flag_reason: flagReasons.length ? flagReasons.join("; ") : pickString(session.flag_reason),
    })
    .eq("id", session.id);

  if (updateError) throw new Error(updateError.message || "Unable to start session");

  await supabase
    .from("candidates")
    .update({ email, linkedin_url: linkedinUrl })
    .eq("id", session.candidate_id)
    .eq("company_id", session.company_id);

  await insertSessionEvent({
    supabase,
    session,
    eventType: session.started_at || data.responses.length ? "session_resumed" : "session_started",
    eventData: {
      email,
      linkedin_url: linkedinUrl,
      current_question_index: currentIndex,
      flag_reasons: flagReasons,
    },
  });

  return getPipelineSessionByToken(token);
}

export async function openPipelineQuestion(token: string, questionId: string) {
  const data = await getPipelineSessionByToken(token);
  if (!data) throw new Error("Session not found");

  const supabase = createSupabaseServiceClient();
  const session = data.session;
  await activeOrThrow(supabase, session);

  const question = data.questions.find((item) => item.id === questionId);
  if (!question) throw new Error("Question not found");

  const questionIndex = data.questions.findIndex((item) => item.id === questionId);
  const currentIndex = firstUnlockedQuestionIndex(data.questions, data.responses);
  if (questionIndex > currentIndex) throw new Error("Previous questions must be completed first");

  const existing = data.responses.find((response) => pickString(response.question_id) === questionId);
  if (!existing) {
    const { error } = await supabase
      .from("candidate_pipeline_responses")
      .insert({
        company_id: session.company_id,
        pipeline_session_id: session.id,
        candidate_id: session.candidate_id,
        mission_id: session.mission_id,
        pipeline_id: session.pipeline_id,
        step_id: question.step_id,
        question_id: questionId,
        status: "opened",
        started_at: new Date().toISOString(),
        submitted_at: null,
        is_locked: false,
        metadata: { opened_via: "public_apply" },
      });

    if (error) throw new Error(error.message || "Unable to open question");
  } else if (!responseIsLocked(existing) && !pickString(existing.started_at)) {
    await supabase
      .from("candidate_pipeline_responses")
      .update({ started_at: new Date().toISOString() })
      .eq("id", existing.id);
  }

  await supabase
    .from("pipeline_sessions")
    .update({
      status: "in_progress",
      current_question_index: currentIndex,
      total_questions: data.questions.length,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  await insertSessionEvent({
    supabase,
    session,
    questionId,
    eventType: "question_opened",
    eventData: { question_index: questionIndex },
  });

  return getPipelineSessionByToken(token);
}

export async function logPipelineSessionEvent(token: string, input: PipelineSessionEventInput) {
  const data = await getPipelineSessionByToken(token);
  if (!data) throw new Error("Session not found");

  const supabase = createSupabaseServiceClient();
  const session = data.session;
  const eventType = pickString(input.eventType) ?? "unknown_event";
  const questionId = pickString(input.questionId);
  const isCopyEvent = COPY_EVENTS.has(eventType);
  const isFocusEvent = FOCUS_EVENTS.has(eventType);
  const shouldFlag = isCopyEvent || eventType === "tab_blur";
  const now = new Date().toISOString();

  await insertSessionEvent({
    supabase,
    session,
    questionId,
    eventType,
    eventData: input.eventData ?? {},
  });

  if (questionId && (isCopyEvent || isFocusEvent)) {
    const response = data.responses.find((item) => pickString(item.question_id) === questionId);
    if (response) {
      await supabase
        .from("candidate_pipeline_responses")
        .update({
          copy_paste_attempts: (pickNumber(response.copy_paste_attempts) ?? 0) + (isCopyEvent ? 1 : 0),
          focus_lost_count: (pickNumber(response.focus_lost_count) ?? 0) + (isFocusEvent ? 1 : 0),
        })
        .eq("id", response.id);
    }
  }

  await supabase
    .from("pipeline_sessions")
    .update({
      last_seen_at: now,
      is_flagged: session.is_flagged === true || shouldFlag,
      flag_reason: shouldFlag
        ? pickString(session.flag_reason) ?? "assessment integrity event recorded"
        : pickString(session.flag_reason),
    })
    .eq("id", session.id);

  return { success: true };
}

export async function submitPipelineSessionAnswer(token: string, response: PipelineSessionResponseInput) {
  const data = await getPipelineSessionByToken(token);
  if (!data) throw new Error("Session not found");

  const supabase = createSupabaseServiceClient();
  const session = data.session;
  await activeOrThrow(supabase, session);

  const question = data.questions.find((item) => item.id === response.questionId);
  if (!question) throw new Error("Question not found");

  const questionIndex = data.questions.findIndex((item) => item.id === question.id);
  const currentIndex = firstUnlockedQuestionIndex(data.questions, data.responses);
  if (questionIndex < currentIndex) throw new Error("This answer is already locked");
  if (questionIndex > currentIndex) throw new Error("Previous questions must be completed first");

  const existing = data.responses.find((item) => pickString(item.question_id) === question.id);
  if (responseIsLocked(existing)) {
    throw new Error("This answer is already locked");
  }

  const responseJson = asObject(response.responseJson);
  const timeSpentSeconds = Math.max(0, Math.round(
    firstNumber(responseJson.elapsed_seconds, responseJson.time_spent_seconds) ??
    (pickString(existing?.started_at) ? (Date.now() - new Date(String(existing?.started_at)).getTime()) / 1000 : 0),
  ));
  const status = response.status === "timed_out" ? "timed_out" : "locked";
  const now = new Date().toISOString();

  let savedResponse: Record<string, unknown> | null = null;
  if (existing) {
    const { data: updated, error } = await supabase
      .from("candidate_pipeline_responses")
      .update({
        response_text: response.responseText ?? null,
        response_json: responseJson,
        file_document_id: response.fileDocumentId ?? null,
        status,
        submitted_at: now,
        time_spent_seconds: timeSpentSeconds,
        is_locked: true,
        metadata: {
          ...asObject(existing.metadata),
          locked_via: "public_apply",
          timed_out: status === "timed_out",
        },
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message || "Unable to save response");
    savedResponse = asObject(updated);
  } else {
    const { data: inserted, error } = await supabase
      .from("candidate_pipeline_responses")
      .insert({
        company_id: session.company_id,
        pipeline_session_id: session.id,
        candidate_id: session.candidate_id,
        mission_id: session.mission_id,
        pipeline_id: session.pipeline_id,
        step_id: question.step_id,
        question_id: question.id,
        response_text: response.responseText ?? null,
        response_json: responseJson,
        file_document_id: response.fileDocumentId ?? null,
        status,
        started_at: now,
        submitted_at: now,
        time_spent_seconds: timeSpentSeconds,
        is_locked: true,
        metadata: {
          locked_via: "public_apply",
          timed_out: status === "timed_out",
        },
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message || "Unable to save response");
    savedResponse = asObject(inserted);
  }

  const completedIds = new Set(
    data.responses
      .filter((item) => item.id !== existing?.id && responseIsLocked(item))
      .map((item) => pickString(item.question_id))
      .filter((id): id is string => Boolean(id)),
  );
  completedIds.add(question.id);

  const nextIndex = data.questions.findIndex((item) => !completedIds.has(item.id));
  const currentQuestionIndex = nextIndex === -1 ? data.questions.length : nextIndex;
  const completed = currentQuestionIndex >= data.questions.length;
  const totalTimeSpent = data.responses
    .filter((item) => item.id !== existing?.id && responseIsLocked(item))
    .reduce((sum, item) => sum + (pickNumber(item.time_spent_seconds) ?? 0), timeSpentSeconds);

  const sessionStatus = completed ? "completed" : "in_progress";

  const { error: updateError } = await supabase
    .from("pipeline_sessions")
    .update({
      status: sessionStatus,
      current_question_index: currentQuestionIndex,
      total_questions: data.questions.length,
      time_spent_seconds: totalTimeSpent,
      last_seen_at: now,
      completed_at: completed ? now : null,
      submitted_at: completed ? now : session.submitted_at,
    })
    .eq("id", session.id);

  if (updateError) throw new Error(updateError.message || "Unable to update session");

  await insertSessionEvent({
    supabase,
    session,
    questionId: question.id,
    eventType: status === "timed_out" ? "question_timed_out" : "question_submitted",
    eventData: {
      question_index: questionIndex,
      time_spent_seconds: timeSpentSeconds,
      next_question_index: currentQuestionIndex,
    },
  });

  if (completed) {
    await insertSessionEvent({
      supabase,
      session,
      eventType: "session_completed",
      eventData: {
        total_questions: data.questions.length,
        time_spent_seconds: totalTimeSpent,
      },
    });
  }

  return {
    success: true,
    completed,
    currentQuestionIndex,
    response: savedResponse,
    sessionId: session.id,
    companyId: session.company_id,
    candidateId: session.candidate_id,
    applicationId: session.mission_id,
    pipelineId: session.pipeline_id,
    submittedAt: now,
  };
}

export async function submitPipelineSessionResponses(
  token: string,
  responses: PipelineSessionResponseInput[],
) {
  if (!responses.length) {
    throw new Error("At least one response is required");
  }

  let result = null;
  for (const response of responses) {
    result = await submitPipelineSessionAnswer(token, response);
  }

  return result!;
}

export async function updatePipelineSessionCandidateProfile(token: string, input: {
  linkedinUrl?: string | null;
}) {
  const linkedinUrl = pickString(input.linkedinUrl);
  if (!linkedinUrl) return null;

  const data = await getPipelineSessionByToken(token);
  if (!data) throw new Error("Session not found");

  const supabase = createSupabaseServiceClient();
  const { data: updated, error } = await supabase
    .from("candidates")
    .update({ linkedin_url: linkedinUrl })
    .eq("id", data.session.candidate_id)
    .eq("company_id", data.session.company_id)
    .select("id, linkedin_url")
    .single();

  if (error) throw new Error(error.message || "Unable to update candidate profile");
  return updated;
}
