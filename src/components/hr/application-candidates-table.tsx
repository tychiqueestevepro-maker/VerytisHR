"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Brain, BriefcaseBusiness, Building2, ExternalLink, Loader2, SearchCheck, Target, Trophy, Upload, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { Avatar, LinkedInLink, ScoreBadge, StatusBadge } from "@/components/hr/application-components";
import { cn } from "@/lib/utils";

export type CandidateTableRow = {
  id: string;
  name: string;
  profileImageUrl?: string | null;
  subtitle: string;
  currentRole: string;
  currentCompany: string;
  linkedin: string;
  linkedinUrl?: string | null;
  fitScore: number | null;
  opportunityScore: number | null;
  signals: string[];
  status: string;
  recommendation: string;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "not_analyzed", label: "Not analyzed" },
  { key: "linkedin_missing", label: "LinkedIn missing" },
  { key: "low_fit", label: "Low fit" },
  { key: "contact_first", label: "Contact first" },
  { key: "review_needed", label: "Review needed" },
  { key: "do_not_contact", label: "Do not contact" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function CandidateSidePanel({
  candidate,
  onClose,
}: {
  candidate: CandidateTableRow | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!candidate) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [candidate, onClose]);

  if (!candidate) return null;

  const linkedinUrl = candidate.linkedinUrl
    ? candidate.linkedinUrl.startsWith("http://") || candidate.linkedinUrl.startsWith("https://")
      ? candidate.linkedinUrl
      : `https://${candidate.linkedinUrl}`
    : null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close candidate panel"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-background/45 backdrop-blur-[2px]"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-border bg-background shadow-2xl">
        <header className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/35">Talent pool profile</p>
              <h1 className="mt-1 truncate text-xl font-semibold text-foreground">{candidate.name}</h1>
              <p className="mt-1 text-sm text-foreground/50">{candidate.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-foreground/55 transition hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge>{candidate.recommendation}</StatusBadge>
            <span className="text-xs text-foreground/40">Fit</span>
            <ScoreBadge value={candidate.fitScore} />
            <span className="text-xs text-foreground/40">Opportunity</span>
            <ScoreBadge value={candidate.opportunityScore} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-6">
            <section className="border-t border-border pt-4">
              <div className="divide-y divide-border/70">
                <div className="flex min-h-12 items-start gap-3 py-3">
                  <BriefcaseBusiness className="mt-0.5 size-4 shrink-0 text-foreground/35" />
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/35">Current role</p>
                    <p className="mt-1 text-sm text-foreground/75">{candidate.currentRole}</p>
                  </div>
                </div>
                <div className="flex min-h-12 items-start gap-3 py-3">
                  <Building2 className="mt-0.5 size-4 shrink-0 text-foreground/35" />
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/35">Current company</p>
                    <p className="mt-1 text-sm text-foreground/75">{candidate.currentCompany}</p>
                  </div>
                </div>
                <div className="flex min-h-12 items-start gap-3 py-3">
                  <SearchCheck className="mt-0.5 size-4 shrink-0 text-foreground/35" />
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/35">LinkedIn</p>
                    <p className="mt-1 text-sm text-foreground/75">{candidate.linkedin}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="border-t border-border pt-4">
              <div className="mb-3 flex items-center gap-2">
                <Target className="size-4 text-foreground/40" />
                <h2 className="text-sm font-semibold text-foreground">Analysis signals</h2>
              </div>
              <ul className="space-y-2 text-sm leading-6 text-foreground/65">
                {(candidate.signals.length ? candidate.signals : ["Run analysis to generate sourcing signals."]).map((signal) => (
                  <li key={signal} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">{signal}</li>
                ))}
              </ul>
            </section>

            {linkedinUrl ? (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground"
              >
                Open LinkedIn
                <ExternalLink className="size-4" />
              </a>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function ApplicationCandidatesTable({ 
  applicationId, 
  candidates,
  workflowType = "sourcing"
}: { 
  applicationId: string; 
  candidates: CandidateTableRow[];
  workflowType?: "sourcing" | "application";
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [isAnalyzing, setAnalyzing] = useState(false);
  const [isPreparingLinkedIn, setPreparingLinkedIn] = useState(false);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);

  const base = workflowType === "sourcing" ? "/hr/sourcing" : "/hr/applications";
  const importHref = workflowType === "sourcing" ? `${base}/${applicationId}/import` : `${base}/${applicationId}/applications`;
  const resultsHref = workflowType === "sourcing" ? `${base}/${applicationId}/results` : `${base}/${applicationId}/applications/results`;

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      if (filter === "not_analyzed") return candidate.fitScore === null && candidate.opportunityScore === null;
      if (filter === "linkedin_missing") return candidate.linkedin === "Missing";
      if (filter === "low_fit") return candidate.fitScore !== null && candidate.fitScore < 60;
      if (filter === "contact_first") return candidate.recommendation === "Contact first" || candidate.recommendation === "Strong match";
      if (filter === "review_needed") return candidate.recommendation === "Review";
      if (filter === "do_not_contact") return candidate.recommendation === "Do not contact" || candidate.recommendation === "Low fit" || candidate.recommendation === "Reject";
      return true;
    });
  }, [candidates, filter]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = filteredCandidates.length > 0 && filteredCandidates.every((c) => selected.has(c.id));
  const activeCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === activeCandidateId) ?? null,
    [activeCandidateId, candidates],
  );

  useEffect(() => {
    function onExtensionMessage(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data as { type?: string; success?: boolean; error?: string | null };
      if (data.type !== "VERYTIS_SOURCING_VERIFICATION_DONE") return;

      setPreparingLinkedIn(false);
      if (data.success) {
        setMessage("LinkedIn verification saved. The profile intelligence is now available for analysis.");
        router.refresh();
      } else {
        setMessage(data.error || "LinkedIn verification failed.");
      }
    }

    window.addEventListener("message", onExtensionMessage);
    return () => window.removeEventListener("message", onExtensionMessage);
  }, [router]);

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredCandidates.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredCandidates.forEach((c) => next.add(c.id));
        return next;
      });
    }
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (!ids.length) {
      setMessage("Select at least one candidate.");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${ids.length} candidate${ids.length > 1 ? "s" : ""}?`)) return;

    setAnalyzing(true);
    setMessage(null);

    try {
      for (const id of ids) {
        const response = await fetch(`/api/hr/candidates/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Unable to delete some candidates");
      }

      setSelected(new Set());
      setMessage(`${ids.length} candidate${ids.length > 1 ? "s" : ""} deleted.`);
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to delete candidates");
    } finally {
      setAnalyzing(false);
    }
  }

  async function analyzeSelected() {
    const ids = [...selected];
    if (!ids.length) {
      setMessage("Select at least one candidate.");
      return;
    }

    setAnalyzing(true);
    setMessage(null);

    try {
      for (const id of ids) {
        const response = await fetch(`/api/hr/sourcing-profiles/${id}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Unable to analyze sourcing profile");
      }

      setSelected(new Set());
      setMessage(`${ids.length} profile${ids.length > 1 ? "s" : ""} analyzed.`);
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to analyze profiles");
    } finally {
      setAnalyzing(false);
    }
  }

  async function prepareLinkedInVerification() {
    const ids = [...selected];
    if (ids.length !== 1) {
      setMessage("Select exactly one candidate to verify on LinkedIn.");
      return;
    }

    const candidate = candidates.find((item) => item.id === ids[0]);
    if (!candidate) {
      setMessage("Selected candidate was not found.");
      return;
    }

    if (!candidate.linkedinUrl) {
      setMessage("This candidate has no LinkedIn URL.");
      return;
    }

    setPreparingLinkedIn(true);
    setMessage(null);

    try {
      const response = await fetch("/api/hr/extension-tokens", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.token !== "string") {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to connect the LinkedIn extension");
      }

      const requestId = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let extensionAcknowledged = false;

      const waitForExtension = new Promise<boolean>((resolve) => {
        const timeout = window.setTimeout(() => {
          window.removeEventListener("message", onExtensionConnected);
          resolve(false);
        }, 1200);

        function onExtensionConnected(event: MessageEvent) {
          if (event.source !== window) return;
          const data = event.data as { type?: string; requestId?: string; success?: boolean };
          if (data.type !== "VERYTIS_EXTENSION_CONNECTED" || data.requestId !== requestId) return;

          extensionAcknowledged = Boolean(data.success);
          window.clearTimeout(timeout);
          window.removeEventListener("message", onExtensionConnected);
          resolve(extensionAcknowledged);
        }

        window.addEventListener("message", onExtensionConnected);
      });

      window.postMessage({
        type: "VERYTIS_CONNECT_EXTENSION",
        requestId,
        extensionToken: body.token,
        apiBase: window.location.origin,
        sourcingProfileId: candidate.id,
        candidateId: candidate.id,
        linkedinUrl: candidate.linkedinUrl,
        autoStart: true,
      }, "*");

      const extensionStarted = await waitForExtension;
      if (!extensionStarted) {
        window.open(candidate.linkedinUrl, "_blank", "noopener,noreferrer");
        setMessage("LinkedIn opened, but the extension did not answer. Check that the Verytis extension is installed and enabled.");
        return;
      }

      setMessage("LinkedIn verification started. The extension will open LinkedIn, capture the visible profile and save it in Verytis.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to prepare LinkedIn verification");
    } finally {
      setPreparingLinkedIn(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-foreground/45 uppercase tracking-wider">Filter:</p>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterKey)}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground/70 transition hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-foreground/20"
          >
            {FILTERS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          
          <div className="ml-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="select-all"
              checked={allSelected}
              onChange={toggleAll}
              className="size-4 accent-pink-500 cursor-pointer rounded border-gray-300"
            />
            <label htmlFor="select-all" className="text-xs font-medium text-foreground/45 cursor-pointer">
              Select all
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={analyzeSelected}
            disabled={isAnalyzing}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-pink-200 bg-pink-500 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-pink-600 disabled:pointer-events-none disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 className="size-3.5 animate-spin" /> : <Brain className="size-3.5" />}
            Run AI analysis
          </button>
          <button
            type="button"
            onClick={prepareLinkedInVerification}
            disabled={isPreparingLinkedIn || isAnalyzing}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-xs font-medium text-foreground/65 transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {isPreparingLinkedIn ? <Loader2 className="size-3.5 animate-spin" /> : <SearchCheck className="size-3.5" />}
            Verify LinkedIn
          </button>
          <Link
            href={importHref}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-xs font-medium text-foreground/65 transition hover:bg-secondary hover:text-foreground"
          >
            <Upload className="size-3.5" />
            Import
          </Link>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={isAnalyzing || !selected.size}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-foreground/55">{message}</p> : null}

      <div className="flex flex-col gap-3">
        {filteredCandidates.map((candidate) => (
          <div
            key={candidate.id}
            className={cn(
              "group relative flex items-center gap-6 rounded-2xl border border-white/40 bg-white/40 p-4 pr-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md transition-all duration-300 hover:border-pink-500/20 hover:shadow-[0_20px_40px_rgba(236,72,153,0.08)] cursor-pointer",
              selected.has(candidate.id) && "border-pink-500/30 bg-pink-500/[0.02]"
            )}
            onClick={() => setActiveCandidateId(candidate.id)}
          >
            {/* Hover Gradient */}
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-pink-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

            <div className="relative flex items-center pr-2 z-10" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selected.has(candidate.id)}
                onChange={() => toggle(candidate.id)}
                className="size-5 accent-pink-500 cursor-pointer rounded border-gray-300 transition-transform active:scale-90"
              />
            </div>

            <div className="relative flex flex-1 items-center gap-8">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-4">
                  <Avatar src={candidate.profileImageUrl} name={candidate.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-foreground group-hover:text-pink-600 transition-colors truncate">
                      {candidate.name}
                    </h3>
                    <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-wider truncate max-w-[350px]">
                      {candidate.subtitle}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-foreground/30 font-bold uppercase tracking-widest">
                  {(candidate.fitScore !== null || candidate.opportunityScore !== null) && (
                    <>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge>{candidate.recommendation || "Pending"}</StatusBadge>
                      </div>
                      <span className="text-foreground/10 shrink-0">•</span>
                    </>
                  )}
                  <div className="flex min-w-0 items-center gap-1.5">
                    <BriefcaseBusiness className="size-3 text-foreground/20 shrink-0" />
                    <span className="truncate max-w-[300px]">{candidate.currentRole} at {candidate.currentCompany}</span>
                  </div>
                  {(candidate.signals?.[0] || candidate.fitScore !== null) && (
                    <>
                      <span className="text-foreground/10 shrink-0">•</span>
                      <div className="max-w-[300px] truncate italic text-foreground/45 font-medium">
                        {candidate.signals[0] || "Analysis completed"}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="relative flex items-center gap-8 shrink-0 pr-4 z-10">
              <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                <LinkedInLink url={candidate.linkedinUrl} />
              </div>

              <div className="flex items-center gap-6 pl-6 border-l border-black/[0.03]">
                <div className="flex flex-col items-end justify-center min-w-[70px]">
                  <span className="text-[9px] text-foreground/25 font-black uppercase tracking-[0.15em] mb-1">Fit Score</span>
                  <ScoreBadge value={candidate.fitScore} />
                </div>
                <div className="flex flex-col items-end justify-center min-w-[70px]">
                  <span className="text-[9px] text-foreground/25 font-black uppercase tracking-[0.15em] mb-1">Opportunity</span>
                  <ScoreBadge value={candidate.opportunityScore} />
                </div>
              </div>

              <div className="absolute right-[-24px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                <ArrowUpRight className="size-5 text-pink-500" />
              </div>
            </div>
          </div>
        ))}
        
        {!filteredCandidates.length ? (
          <div className="py-12 text-center text-sm text-foreground/45 bg-white/20 rounded-2xl border border-dashed border-white/40">
            No candidates match this filter.
          </div>
        ) : null}
      </div>

      <CandidateSidePanel candidate={activeCandidate} onClose={() => setActiveCandidateId(null)} />
    </div>
  );
}
