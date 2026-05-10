"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";

export function PublicMissionApplyForm({
  missionSlug,
  requireCvUpload = true,
  requireLinkedinUrl = true,
}: {
  missionSlug: string;
  requireCvUpload?: boolean;
  requireLinkedinUrl?: boolean;
}) {
  const [isSubmitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const email = typeof form.get("email") === "string" ? String(form.get("email")).trim() : "";
    const linkedinUrl = typeof form.get("linkedin_url") === "string" ? String(form.get("linkedin_url")).trim() : "";
    const cvFile = form.get("cv");

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(missionSlug)}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, linkedinUrl }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to start application");
      }

      const token = typeof body.token === "string" ? body.token : null;
      if (token && cvFile instanceof File && cvFile.size > 0) {
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

      const url = typeof body.url === "string" ? body.url : token ? `/apply/session/${token}` : null;
      if (!url) throw new Error("Application session created, but no session link was returned");
      window.location.assign(url);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to start application");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 border-y border-border py-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Start your application</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/55">
          Enter your details once. A private assessment session will be created for you automatically.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-foreground/35">Email</span>
          <input
            name="email"
            type="email"
            required
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
        <label>
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-foreground/35">LinkedIn URL</span>
          <input
            name="linkedin_url"
            type="url"
            required={requireLinkedinUrl}
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
        disabled={isSubmitting}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/85 disabled:pointer-events-none disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Start assessment
      </button>
    </form>
  );
}
