"use client";

import { useMemo, useState } from "react";
import { BrainCircuit, Copy, Link2, Loader2, RefreshCw, Wand2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";

export type PipelineCandidateOption = {
  id: string;
  name: string;
};

export type PipelineSessionAction = {
  token: string | null;
  status: string;
};

const ANALYZABLE_SESSION_STATUSES = new Set(["submitted", "completed", "flagged"]);

export function ApplicationPipelineActions({
  applicationId,
  pipelineId,
  publicApplyPath,
  candidates,
  sessions,
}: {
  applicationId: string;
  pipelineId: string | null;
  publicApplyPath?: string | null;
  candidates: PipelineCandidateOption[];
  sessions: PipelineSessionAction[];
}) {
  const router = useRouter();
  const [candidateId, setCandidateId] = useState(candidates[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const submittedTokens = useMemo(
    () => sessions
      .filter((session) => session.token && ANALYZABLE_SESSION_STATUSES.has(session.status))
      .map((session) => session.token as string),
    [sessions],
  );

  async function generatePipeline(action: "generate" | "regenerate") {
    setBusyAction(action);
    setMessage(null);
    try {
      const response = await fetch(`/api/hr/applications/${applicationId}/pipeline`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to generate pipeline");
      setMessage(action === "generate" ? "Pipeline generated." : "Questions regenerated.");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to generate pipeline");
    } finally {
      setBusyAction(null);
    }
  }

  async function createCandidateLink() {
    if (!pipelineId || !candidateId) {
      setMessage("Generate a pipeline and select a candidate first.");
      return;
    }

    setBusyAction("link");
    setMessage(null);
    try {
      const response = await fetch("/api/hr/pipeline-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, pipelineId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to create candidate link");

      const url = typeof body.url === "string" ? `${window.location.origin}${body.url}` : "Candidate link created.";
      if (navigator.clipboard && typeof body.url === "string") {
        await navigator.clipboard.writeText(url).catch(() => undefined);
      }
      setMessage(typeof body.url === "string" ? `Copied: ${url}` : "Candidate link created.");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to create candidate link");
    } finally {
      setBusyAction(null);
    }
  }

  async function copyPublicApplyLink() {
    if (!publicApplyPath) {
      setMessage("Public apply link is not enabled.");
      return;
    }

    const url = `${window.location.origin}${publicApplyPath}`;
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setMessage(`Copied: ${url}`);
  }

  async function analyzeResponses() {
    if (!submittedTokens.length) {
      setMessage("No submitted responses to analyze.");
      return;
    }

    setBusyAction("analyze");
    setMessage(null);
    try {
      for (const token of submittedTokens) {
        const response = await fetch(`/api/hr/pipeline-sessions/${token}/analyze`, { method: "POST" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to analyze responses");
      }
      setMessage(`${submittedTokens.length} response${submittedTokens.length > 1 ? "s" : ""} analyzed.`);
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to analyze responses");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-3 border-y border-border py-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => generatePipeline("generate")}
          disabled={busyAction !== null}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-foreground bg-foreground px-3 text-sm font-medium text-background transition hover:bg-foreground/85 disabled:pointer-events-none disabled:opacity-50"
        >
          {busyAction === "generate" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          Generate pipeline
        </button>
        <button
          type="button"
          onClick={() => generatePipeline("regenerate")}
          disabled={busyAction !== null}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {busyAction === "regenerate" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Regenerate questions
        </button>
        <select
          value={candidateId}
          onChange={(event) => setCandidateId(event.target.value)}
          className="h-9 min-w-52 rounded-md border border-input bg-background px-3 text-sm"
        >
          {candidates.length ? candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
          )) : <option value="">No candidates</option>}
        </select>
        <button
          type="button"
          onClick={copyPublicApplyLink}
          disabled={busyAction !== null || !publicApplyPath}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <Link2 className="size-4" />
          Copy public apply link
        </button>
        <button
          type="button"
          onClick={createCandidateLink}
          disabled={busyAction !== null || !pipelineId || !candidates.length}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {busyAction === "link" ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
          Create candidate link
        </button>
        <button
          type="button"
          onClick={analyzeResponses}
          disabled={busyAction !== null}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {busyAction === "analyze" ? <Loader2 className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}
          Analyze responses
        </button>
        <a
          href="#candidate-links"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground"
        >
          <Link2 className="size-4" />
          View responses
        </a>
      </div>
      {message ? <p className="text-sm text-foreground/55">{message}</p> : null}
    </div>
  );
}

export const MissionPipelineActions = ApplicationPipelineActions;
