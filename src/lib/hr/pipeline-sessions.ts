import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { pickString } from "./utils";

type PipelineSessionStatus = "opened" | "submitted" | "analyzed" | "failed" | "expired" | "cancelled";

type PipelineSessionRow = {
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

async function findOpenPipelineSession(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  candidateId: string,
  pipelineId: string,
) {
  const { data, error } = await supabase
    .from("pipeline_sessions")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("pipeline_id", pipelineId)
    .eq("status", "opened")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load existing pipeline session");
  }

  return data as PipelineSessionRow | null;
}

function isExpired(session: PipelineSessionRow) {
  return Boolean(session.expires_at && new Date(session.expires_at).getTime() < Date.now());
}

function assertUuidToken(token: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    throw new Error("Invalid session token");
  }
}

export async function createPipelineSession(input: CreatePipelineSessionInput) {
  const supabase = createSupabaseServiceClient();
  const existingSession = await findOpenPipelineSession(supabase, input.candidateId, input.pipelineId);
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
      candidate_email: input.candidateEmail ?? null,
      candidate_name: input.candidateName ?? null,
      expires_at: input.expiresAt ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const concurrentSession = await findOpenPipelineSession(supabase, input.candidateId, input.pipelineId);
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

  if (typedSession.status === "opened" && !typedSession.started_at) {
    const now = new Date().toISOString();
    await supabase
      .from("pipeline_sessions")
      .update({ started_at: now })
      .eq("id", typedSession.id);

    typedSession.started_at = now;
  }

  const [{ data: pipeline }, { data: steps }, { data: questions }, { data: mission }] = await Promise.all([
    supabase
      .from("pipelines")
      .select("id, name, description, status, mission_id")
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
  ]);

  return {
    session: typedSession,
    pipeline,
    mission,
    application: mission,
    steps: (steps ?? []) as PipelineStepRow[],
    questions: (questions ?? []) as PipelineQuestionRow[],
  };
}

export async function submitPipelineSessionResponses(
  token: string,
  responses: PipelineSessionResponseInput[],
) {
  assertUuidToken(token);

  if (!responses.length) {
    throw new Error("At least one response is required");
  }

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
    throw new Error("Session not found");
  }

  const typedSession = session as PipelineSessionRow;
  if (typedSession.status === "submitted" || typedSession.status === "analyzed") {
    throw new Error("Session already submitted");
  }

  if (
    typedSession.status === "cancelled" ||
    typedSession.status === "expired" ||
    typedSession.status === "failed" ||
    isExpired(typedSession)
  ) {
    throw new Error("Session is no longer active");
  }

  const questionIds = [...new Set(responses.map((response) => response.questionId))];
  const { data: questions, error: questionsError } = await supabase
    .from("pipeline_questions")
    .select("id, step_id")
    .eq("pipeline_id", typedSession.pipeline_id)
    .in("id", questionIds);

  if (questionsError) {
    throw new Error(questionsError.message || "Unable to validate responses");
  }

  const questionsById = new Map(
    ((questions ?? []) as Array<{ id: string; step_id: string | null }>).map((question) => [question.id, question]),
  );

  if (questionsById.size !== questionIds.length) {
    throw new Error("One or more questions do not belong to this session");
  }

  const rows = responses.map((response) => {
    const question = questionsById.get(response.questionId);

    return {
      company_id: typedSession.company_id,
      pipeline_session_id: typedSession.id,
      candidate_id: typedSession.candidate_id,
      mission_id: typedSession.mission_id,
      pipeline_id: typedSession.pipeline_id,
      step_id: question?.step_id ?? null,
      question_id: response.questionId,
      response_text: response.responseText ?? null,
      response_json: response.responseJson ?? {},
      file_document_id: response.fileDocumentId ?? null,
      status: "submitted",
    };
  });

  const { error: insertError } = await supabase
    .from("candidate_pipeline_responses")
    .insert(rows);

  if (insertError) {
    throw new Error(insertError.message || "Unable to save responses");
  }

  const submittedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("pipeline_sessions")
    .update({ status: "submitted", submitted_at: submittedAt })
    .eq("id", typedSession.id);

  if (updateError) {
    throw new Error(updateError.message || "Unable to submit session");
  }

  return {
    submittedAt,
    sessionId: typedSession.id,
    companyId: typedSession.company_id,
    candidateId: typedSession.candidate_id,
    applicationId: typedSession.mission_id,
    pipelineId: typedSession.pipeline_id,
  };
}

export async function updatePipelineSessionCandidateProfile(token: string, input: {
  linkedinUrl?: string | null;
}) {
  assertUuidToken(token);

  const linkedinUrl = pickString(input.linkedinUrl);
  if (!linkedinUrl) return null;

  const supabase = createSupabaseServiceClient();
  const { data: session, error: sessionError } = await supabase
    .from("pipeline_sessions")
    .select("id, candidate_id, company_id, status, expires_at")
    .eq("public_token", token)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message || "Unable to load pipeline session");
  if (!session) throw new Error("Session not found");

  const typedSession = session as PipelineSessionRow;
  if (
    typedSession.status === "cancelled" ||
    typedSession.status === "expired" ||
    typedSession.status === "failed" ||
    isExpired(typedSession)
  ) {
    throw new Error("Session is no longer active");
  }

  const { data, error } = await supabase
    .from("candidates")
    .update({ linkedin_url: linkedinUrl })
    .eq("id", typedSession.candidate_id)
    .eq("company_id", typedSession.company_id)
    .select("id, linkedin_url")
    .single();

  if (error) throw new Error(error.message || "Unable to update candidate profile");
  return data;
}
