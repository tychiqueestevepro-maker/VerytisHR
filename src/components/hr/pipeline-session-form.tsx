"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

type Question = {
  id: string;
  label: string;
  description: string | null;
  placeholder: string | null;
  is_required: boolean;
};

export function PipelineSessionForm({
  token,
  questions,
  status,
}: {
  token: string;
  questions: Question[];
  status: string;
}) {
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(status === "submitted" || status === "analyzed");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const cvFile = form.get("cv");
    const linkedinUrl = typeof form.get("linkedin_url") === "string" ? String(form.get("linkedin_url")).trim() : "";
    const responses = questions.map((question) => ({
      questionId: question.id,
      responseText: typeof form.get(question.id) === "string" ? String(form.get(question.id)) : null,
      responseJson: {},
    }));

    try {
      if (!(cvFile instanceof File) || cvFile.size === 0) {
        throw new Error("CV file is required");
      }

      if (!linkedinUrl) {
        throw new Error("LinkedIn URL is required");
      }

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

      const response = await fetch(`/api/pipeline-sessions/${token}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl, responses }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to submit responses");
      }

      setSubmitted(true);
      setMessage("Responses submitted.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to submit responses");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="border-y border-border py-12 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-8 text-emerald-600" />
        <p className="text-lg font-semibold text-foreground">Responses submitted</p>
        <p className="mt-2 text-sm text-foreground/50">The recruiting team can now review your answers.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="border-t border-border pt-5">
        <h2 className="text-base font-semibold text-foreground">Application profile</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-foreground/35">CV</span>
            <input
              name="cv"
              type="file"
              required
              accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-foreground/35">LinkedIn URL</span>
            <input
              name="linkedin_url"
              type="url"
              required
              placeholder="https://www.linkedin.com/in/..."
              className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
            />
          </label>
        </div>
      </section>

      {questions.map((question, index) => (
        <label key={question.id} className="block border-t border-border pt-5">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-foreground/35">Question {index + 1}</span>
          <span className="mt-2 block text-base font-semibold text-foreground">{question.label}</span>
          {question.description ? <span className="mt-1 block text-sm leading-6 text-foreground/55">{question.description}</span> : null}
          <textarea
            name={question.id}
            required={question.is_required}
            placeholder={question.placeholder ?? "Write your answer here."}
            className="mt-3 min-h-36 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
          />
        </label>
      ))}

      {message ? <p className="text-sm text-foreground/55">{message}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting || !questions.length}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/85 disabled:pointer-events-none disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Submit responses
      </button>
    </form>
  );
}
