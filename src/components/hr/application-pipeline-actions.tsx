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
}: {
  applicationId: string;
  pipelineId: string | null;
  publicApplyPath?: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

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

  async function copyPublicApplyLink() {
    if (!publicApplyPath) {
      setMessage("Public apply link is not enabled.");
      return;
    }

    const url = `${window.location.origin}${publicApplyPath}`;
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setMessage(`Copied: ${url}`);
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
        <button
          type="button"
          onClick={copyPublicApplyLink}
          disabled={busyAction !== null || !publicApplyPath}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <Link2 className="size-4" />
          Copy public apply link
        </button>
      </div>
      {message ? <p className="text-sm text-foreground/55">{message}</p> : null}
    </div>
  );
}

export const MissionPipelineActions = ApplicationPipelineActions;
