"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type SyntheticEvent } from "react";
import { CheckCircle2, Clock3, Loader2, Send } from "lucide-react";
import { asObject, pickNumber, pickString } from "@/lib/hr/utils";

type Question = {
  id: string;
  question_type: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  options: unknown[];
  is_required: boolean;
  validation_rules: Record<string, unknown>;
};

type SessionSnapshot = Record<string, unknown> & {
  status?: string;
  started_at?: string | null;
  candidate_email?: string | null;
  candidate_linkedin_url?: string | null;
  current_question_index?: number | null;
  total_questions?: number | null;
  time_limit_minutes?: number | null;
};

type ResponseSnapshot = Record<string, unknown> & {
  id?: string;
  question_id?: string | null;
  response_text?: string | null;
  response_json?: Record<string, unknown>;
  status?: string;
  is_locked?: boolean;
};

function questionFormat(question: Question) {
  return pickString(asObject(question.validation_rules).question_type, question.question_type)?.toLowerCase().replace(/-/g, "_") ?? "written_answer";
}

function formatLabel(value: string) {
  const label = value.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function timeLimitSeconds(question: Question) {
  return pickNumber(asObject(question.validation_rules).time_limit_seconds);
}

function points(question: Question) {
  return pickNumber(asObject(question.validation_rules).points);
}

function requiresReasoning(question: Question) {
  return asObject(question.validation_rules).requires_reasoning === true;
}

function antiCheatLevel(question: Question) {
  return pickString(asObject(question.validation_rules).anti_cheat_level) ?? "low";
}

function timeLabel(seconds: number | null) {
  if (!seconds) return null;
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round((seconds / 60) * 10) / 10;
  return `${minutes} min`;
}

function choiceOptions(question: Question) {
  return Array.isArray(question.options) ? question.options.map(String).filter(Boolean) : [];
}

function responseIsLocked(response: ResponseSnapshot | null | undefined) {
  const status = pickString(response?.status);
  return response?.is_locked === true || status === "locked" || status === "submitted" || status === "timed_out";
}

function firstUnlockedIndex(questions: Question[], responses: ResponseSnapshot[]) {
  const locked = new Set(
    responses
      .filter(responseIsLocked)
      .map((response) => pickString(response.question_id))
      .filter((id): id is string => Boolean(id)),
  );
  const index = questions.findIndex((question) => !locked.has(question.id));
  return index === -1 ? questions.length : index;
}

function secondsRemaining(startedAt: number | null, limitSeconds: number | null, now: number) {
  if (!startedAt || !limitSeconds) return null;
  return Math.max(0, limitSeconds - Math.floor((now - startedAt) / 1000));
}

function completedStatus(status: string | null) {
  return status === "completed" || status === "submitted" || status === "analyzed";
}

export function PipelineSessionForm({
  token,
  questions,
  session,
  initialResponses = [],
  requireCvUpload = true,
  requireLinkedinUrl = true,
}: {
  token: string;
  questions: Question[];
  session: SessionSnapshot;
  initialResponses?: ResponseSnapshot[];
  requireCvUpload?: boolean;
  requireLinkedinUrl?: boolean;
}) {
  const initialStatus = pickString(session.status) ?? "not_started";
  const [sessionState, setSessionState] = useState<SessionSnapshot>(session);
  const [responses, setResponses] = useState<ResponseSnapshot[]>(initialResponses);
  const [identified, setIdentified] = useState(() => {
    if (completedStatus(initialStatus)) return true;
    if (initialStatus === "not_started" || initialStatus === "opened") return false;
    return Boolean(
      pickString(session.candidate_email) &&
      (pickString(session.candidate_linkedin_url) || !requireLinkedinUrl),
    );
  });
  const [isStarting, setStarting] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [questionStartedAt, setQuestionStartedAt] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const openedQuestionIdsRef = useRef(new Set<string>());
  const timedOutQuestionIdsRef = useRef(new Set<string>());

  const status = pickString(sessionState.status) ?? "not_started";
  const currentIndex = Math.min(
    questions.length,
    pickNumber(sessionState.current_question_index) ?? firstUnlockedIndex(questions, responses),
  );
  const currentQuestion = questions[currentIndex] ?? null;
  const isComplete = completedStatus(status) || currentIndex >= questions.length;
  const currentFormat = currentQuestion ? questionFormat(currentQuestion) : "written_answer";
  const isChoice = currentFormat === "multiple_choice" || currentFormat === "single_choice";
  const questionStarted = currentQuestion ? questionStartedAt[currentQuestion.id] ?? null : null;
  const questionRemaining = currentQuestion ? secondsRemaining(questionStarted, timeLimitSeconds(currentQuestion), now) : null;
  const globalStartedAt = pickString(sessionState.started_at) ? new Date(String(sessionState.started_at)).getTime() : null;
  const globalRemaining = secondsRemaining(globalStartedAt, (pickNumber(sessionState.time_limit_minutes) ?? 25) * 60, now);
  const responseByQuestion = useMemo(
    () => new Map(responses.map((response) => [pickString(response.question_id), response])),
    [responses],
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!identified || isComplete) return;

    function onVisibilityChange() {
      void logEvent(document.hidden ? "tab_blur" : "tab_focus");
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  });

  useEffect(() => {
    if (!identified || !currentQuestion || questionRemaining !== 0 || timedOutQuestionIdsRef.current.has(currentQuestion.id) || isSubmitting) return;

    timedOutQuestionIdsRef.current.add(currentQuestion.id);
    void submitCurrentAnswer({ timedOut: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identified, currentQuestion?.id, questionRemaining, isSubmitting]);

  async function logEvent(eventType: string, eventData: Record<string, unknown> = {}) {
    if (!identified && eventType !== "session_started") return;

    await fetch(`/api/pipeline-sessions/${token}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        questionId: currentQuestion?.id ?? null,
        eventData,
      }),
    }).catch(() => undefined);
  }

  function blockAndLog(event: SyntheticEvent, eventType: string) {
    event.preventDefault();
    void logEvent(eventType);
  }

  function beginQuestion(question: Question) {
    setQuestionStartedAt((current) => current[question.id] ? current : { ...current, [question.id]: Date.now() });

    if (openedQuestionIdsRef.current.has(question.id)) return;
    openedQuestionIdsRef.current.add(question.id);

    fetch(`/api/pipeline-sessions/${token}/questions/${question.id}/open`, { method: "POST" })
      .then((response) => response.json().catch(() => ({})))
      .then((body) => {
        if (Array.isArray(body.responses)) setResponses(body.responses);
        if (body.session) setSessionState(body.session);
      })
      .catch(() => undefined);
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && (key === "v" || key === "c" || key === "x")) {
      event.preventDefault();
      void logEvent(key === "v" ? "paste_attempt" : key === "c" ? "copy_attempt" : "cut_attempt", { shortcut: true });
    }
  }

  async function startSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStarting(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const email = typeof form.get("email") === "string" ? String(form.get("email")).trim() : "";
    const linkedinUrl = typeof form.get("linkedin_url") === "string" ? String(form.get("linkedin_url")).trim() : "";
    const cvFile = form.get("cv");

    try {
      const response = await fetch(`/api/pipeline-sessions/${token}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, linkedinUrl }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to start session");
      }

      if (body.session) setSessionState(body.session);
      if (Array.isArray(body.responses)) setResponses(body.responses);
      setIdentified(true);

      if (cvFile instanceof File && cvFile.size > 0) {
        const cvForm = new FormData();
        cvForm.set("file", cvFile);
        const cvResponse = await fetch(`/api/pipeline-sessions/${token}/cv`, {
          method: "POST",
          body: cvForm,
        });
        const cvBody = await cvResponse.json().catch(() => ({}));
        if (!cvResponse.ok) {
          throw new Error(typeof cvBody.error === "string" ? cvBody.error : "Unable to upload CV");
        }
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to start session");
    } finally {
      setStarting(false);
    }
  }

  function toggleOption(option: string, checked: boolean) {
    setSelectedOptions((current) => {
      if (currentFormat === "single_choice") return checked ? [option] : [];
      return checked ? [...new Set([...current, option])] : current.filter((item) => item !== option);
    });
  }

  async function submitCurrentAnswer({ timedOut = false }: { timedOut?: boolean } = {}) {
    if (!currentQuestion) return;
    setSubmitting(true);
    setMessage(null);

    const responseText = isChoice
      ? [
          selectedOptions.length ? `Selected: ${selectedOptions.join(", ")}` : "",
          reasoning ? `Justification: ${reasoning}` : "",
        ].filter(Boolean).join("\n\n")
      : answer.trim();

    try {
      if (!timedOut && currentQuestion.is_required && !responseText) {
        throw new Error("This question is required");
      }
      if (!timedOut && isChoice && requiresReasoning(currentQuestion) && !reasoning.trim()) {
        throw new Error("A short justification is required");
      }

      const startedAt = questionStartedAt[currentQuestion.id] ?? Date.now();
      const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      const response = await fetch(`/api/pipeline-sessions/${token}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: {
            questionId: currentQuestion.id,
            responseText: responseText || null,
            status: timedOut ? "timed_out" : "locked",
            responseJson: {
              question_type: currentFormat,
              selected_options: selectedOptions,
              justification: reasoning.trim() || null,
              time_limit_seconds: timeLimitSeconds(currentQuestion),
              points: points(currentQuestion),
              requires_reasoning: requiresReasoning(currentQuestion),
              anti_cheat_level: antiCheatLevel(currentQuestion),
              elapsed_seconds: elapsedSeconds,
              timed_out: timedOut,
            },
          },
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to submit answer");
      }

      if (body.response) {
        setResponses((current) => [
          ...current.filter((item) => pickString(item.question_id) !== currentQuestion.id),
          body.response,
        ]);
      }
      setSessionState((current) => ({
        ...current,
        status: body.completed ? "completed" : pickString(current.status) === "flagged" ? "flagged" : "in_progress",
        current_question_index: body.currentQuestionIndex,
        submitted_at: body.completed ? body.submittedAt : current.submitted_at,
      }));
      setAnswer("");
      setReasoning("");
      setSelectedOptions([]);

      if (body.completed) {
        setMessage("Assessment completed.");
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  if (isComplete) {
    return (
      <div className="border-y border-border py-12 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-8 text-emerald-600" />
        <p className="text-lg font-semibold text-foreground">Assessment completed</p>
        <p className="mt-2 text-sm text-foreground/50">The recruiting team can now review your answers.</p>
      </div>
    );
  }

  if (!identified) {
    return (
      <form onSubmit={startSession} className="space-y-6 border-y border-border py-6">
        <section>
          <h2 className="text-base font-semibold text-foreground">Before you begin</h2>
          <p className="mt-2 text-sm leading-6 text-foreground/55">
            This assessment is designed to evaluate your reasoning in a realistic work context.
          </p>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-foreground/60">
            <li>- You cannot go back after submitting an answer.</li>
            <li>- Copy/paste is disabled.</li>
            <li>- Your progress is saved automatically after each submitted answer.</li>
            <li>- If you leave, you can resume where you stopped.</li>
            <li>- The session must be completed within the allowed time.</li>
          </ul>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-foreground/35">Email</span>
            <input
              name="email"
              type="email"
              required
              defaultValue={pickString(sessionState.candidate_email) ?? ""}
              className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-foreground/35">LinkedIn URL</span>
            <input
              name="linkedin_url"
              type="url"
              required={requireLinkedinUrl}
              defaultValue={pickString(sessionState.candidate_linkedin_url) ?? ""}
              placeholder="https://www.linkedin.com/in/..."
              className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-foreground/35">CV</span>
            <input
              name="cv"
              type="file"
              required={requireCvUpload}
              accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>
        </div>

        {message ? <p className="text-sm text-foreground/55">{message}</p> : null}

        <button
          type="submit"
          disabled={isStarting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/85 disabled:pointer-events-none disabled:opacity-50"
        >
          {isStarting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Start assessment
        </button>
      </form>
    );
  }

  if (!currentQuestion) {
    return <p className="border-y border-border py-8 text-sm text-foreground/50">No question available.</p>;
  }

  const options = choiceOptions(currentQuestion);
  const questionLimit = timeLabel(timeLimitSeconds(currentQuestion));
  const expired = questionRemaining === 0;
  const lockedResponse = responseByQuestion.get(currentQuestion.id);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submitCurrentAnswer();
      }}
      onPaste={(event) => blockAndLog(event, "paste_attempt")}
      onCopy={(event) => blockAndLog(event, "copy_attempt")}
      onCut={(event) => blockAndLog(event, "cut_attempt")}
      onContextMenu={(event) => blockAndLog(event, "context_menu_opened")}
      onDrop={(event) => blockAndLog(event, "drag_drop_attempt")}
      onKeyDown={onKeyDown}
      className="space-y-6"
    >
      <section className="border-y border-border py-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-foreground/35">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span className="rounded-md border border-border px-2 py-1 tracking-normal">{formatLabel(currentFormat)}</span>
          {questionLimit ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 tracking-normal">
              <Clock3 className="size-3" />
              {questionRemaining === null ? questionLimit : expired ? "Timed out" : `${questionRemaining} sec left`}
            </span>
          ) : null}
          {globalRemaining !== null ? (
            <span className="rounded-md border border-border px-2 py-1 tracking-normal">
              Session {Math.max(0, Math.floor(globalRemaining / 60))} min left
            </span>
          ) : null}
          {points(currentQuestion) ? <span className="rounded-md border border-border px-2 py-1 tracking-normal">{points(currentQuestion)} pts</span> : null}
          {requiresReasoning(currentQuestion) ? <span className="rounded-md border border-border px-2 py-1 tracking-normal">Reasoning</span> : null}
          <span className="rounded-md border border-border px-2 py-1 tracking-normal">{antiCheatLevel(currentQuestion)}</span>
        </div>
        <p className="mt-3 text-sm text-foreground/45">Previous answers are locked after submission.</p>
        <h2 className="mt-3 text-lg font-semibold text-foreground">{currentQuestion.label}</h2>
        {currentQuestion.description ? <p className="mt-2 text-sm leading-6 text-foreground/55">{currentQuestion.description}</p> : null}

        {isChoice ? (
          <div className="mt-4 space-y-2">
            {options.map((option) => (
              <label key={option} className="flex items-start gap-3 rounded-md border border-border px-3 py-2 text-sm text-foreground/75">
                <input
                  name={currentQuestion.id}
                  type={currentFormat === "multiple_choice" ? "checkbox" : "radio"}
                  value={option}
                  checked={selectedOptions.includes(option)}
                  aria-disabled={expired}
                  onFocus={() => beginQuestion(currentQuestion)}
                  onClick={(event) => {
                    if (expired) event.preventDefault();
                  }}
                  onChange={(event) => toggleOption(option, event.currentTarget.checked)}
                  className="mt-1"
                />
                <span>{option}</span>
              </label>
            ))}
            {requiresReasoning(currentQuestion) ? (
              <textarea
                name={`${currentQuestion.id}__reasoning`}
                required={currentQuestion.is_required && !expired}
                readOnly={expired}
                value={reasoning}
                onFocus={() => beginQuestion(currentQuestion)}
                onChange={(event) => setReasoning(event.target.value)}
                placeholder="Short justification."
                className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
              />
            ) : null}
          </div>
        ) : (
          <textarea
            name={currentQuestion.id}
            required={currentQuestion.is_required && !expired}
            readOnly={expired}
            value={answer}
            onFocus={() => beginQuestion(currentQuestion)}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder={currentQuestion.placeholder ?? "Write your answer here."}
            className={`${currentFormat === "short_answer" ? "min-h-24" : "min-h-40"} mt-4 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground`}
          />
        )}
      </section>

      {lockedResponse && responseIsLocked(lockedResponse) ? (
        <p className="text-sm text-foreground/55">This answer is already locked.</p>
      ) : null}
      {message ? <p className="text-sm text-foreground/55">{message}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting || Boolean(lockedResponse && responseIsLocked(lockedResponse))}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/85 disabled:pointer-events-none disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Submit and continue
      </button>
    </form>
  );
}
