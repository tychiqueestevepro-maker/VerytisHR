"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, Building2, ExternalLink, Globe, Lightbulb, MapPin, Target, TimerReset, X } from "lucide-react";
import { ScoreBadge, StatusBadge, Avatar, LinkedInLink, CVLink } from "@/components/hr/application-components";
import { pickString } from "@/lib/hr/utils";
import { cn } from "@/lib/utils";

type RowObject = Record<string, unknown>;

export type SourcingAnalysisCandidate = {
  id: string;
  candidate: RowObject;
  candidateMission: RowObject;
  sourceType: string;
  name: string;
  profileImageUrl: string | null;
  subtitle: string;
  currentRole: string;
  currentCompany: string;
  location: string;
  fitScore: number | null;
  opportunityScore: number | null;
  recommendation: string | null;
  whyThisProfile: string | null;
  whyNow: string | null;
  suggestedAngle: string | null;
  sourcingSignals: string[];
  sourcingRisks: string[];
  linkedin: { label: string; status: string };
  linkedinData?: { label: string; status: string };
};

function asObject(value: unknown): RowObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RowObject : {};
}

function normalizedRecommendation(value: unknown) {
  return pickString(value)?.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_") ?? "";
}

function isRejectedRecommendation(value: unknown) {
  const normalized = normalizedRecommendation(value);
  return normalized === "do_not_contact" || normalized === "low_fit" || normalized === "weak_match" || normalized === "reject" || normalized === "rejected";
}

function sourceRelevance(value: unknown) {
  const normalized = pickString(value)?.toLowerCase();
  if (normalized === "matched" || normalized === "uncertain" || normalized === "rejected") return normalized;
  return "uncertain";
}

function sourceBadgeLabel(value: unknown) {
  const relevance = sourceRelevance(value);
  if (relevance === "matched") return "matched";
  if (relevance === "rejected") return "rejected / different company";
  return "uncertain match";
}

function sourceBadgeClass(value: unknown) {
  const relevance = sourceRelevance(value);
  if (relevance === "matched") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (relevance === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function hostnameLabel(value: unknown) {
  const url = pickString(value);
  if (!url) return null;
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

function evidenceItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(asObject)
    .map((item) => ({
      label: pickString(item.label, item.category) ?? "Signal",
      evidence: pickString(item.evidence, item.description),
      category: pickString(item.category),
    }))
    .filter((item) => item.label || item.evidence);
}

function linkedinHref(candidate: SourcingAnalysisCandidate) {
  const rawUrl = pickString(asObject(candidate.candidate).linkedin_url);
  if (!rawUrl) return null;
  return rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`;
}

function DetailLine({ icon: Icon, label, value }: { icon: typeof BriefcaseBusiness; label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-start gap-3 border-b border-border/70 py-2 last:border-0">
      <Icon className="mt-0.5 size-4 shrink-0 text-foreground/35" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/35">{label}</p>
        <p className="mt-1 break-words text-sm text-foreground/75">{value || "-"}</p>
      </div>
    </div>
  );
}

function AnalysisSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof BriefcaseBusiness;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-foreground/40" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function AnalysisDrawer({
  candidate,
  onClose,
}: {
  candidate: SourcingAnalysisCandidate | null;
  onClose: () => void;
}) {
  const open = Boolean(candidate);
  const metadata = asObject(candidate?.candidateMission?.metadata);
  const facts = evidenceItems(metadata.facts);
  const inferences = evidenceItems(metadata.inferences);
  const hypotheses = evidenceItems(metadata.hypotheses);
  const companyResearch = asObject(metadata.company_research);
  const rawRecentCompanySignals = (Array.isArray(metadata.recent_company_signals) ? metadata.recent_company_signals : []).map(asObject);
  const recentCompanySignals = rawRecentCompanySignals.filter((signal) => sourceRelevance(signal.source_relevance) === "matched");
  const checkedCompanySources = (Array.isArray(metadata.company_sources_checked) ? metadata.company_sources_checked : [])
    .map(asObject);
  const sourceRows: RowObject[] = checkedCompanySources.length > 0
    ? checkedCompanySources
    : rawRecentCompanySignals.map((signal) => ({
      label: pickString(signal.label),
      title: pickString(signal.source_title, signal.label),
      url: pickString(signal.source_url),
      reason: pickString(signal.reason),
      source_relevance: sourceRelevance(signal.source_relevance),
    }));
  const hasUnconfirmedCompanySources = sourceRows.some((source) => sourceRelevance(source.source_relevance) !== "matched");
  const companyContextSummary = recentCompanySignals.length > 0
    ? pickString(metadata.company_context_summary) || "Matched company signal found."
    : hasUnconfirmedCompanySources
      ? "Unconfirmed company context. Sources found may refer to a different company, so they were not used to increase the recommendation."
      : "No reliable recent company signal found.";
  const sourceUrls = (Array.isArray(metadata.source_urls) ? metadata.source_urls : []).map(String).filter(Boolean);
  
  const [showEvidence, setShowEvidence] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);
  const linkedinUrl = candidate ? linkedinHref(candidate) : null;


  const isRejected = isRejectedRecommendation(candidate?.recommendation);
  const isStrong = (candidate?.recommendation ?? "").toLowerCase().includes("strong") || (candidate?.recommendation ?? "").toLowerCase().includes("first");
  const recommendationLabel = candidate?.recommendation ?? "Review";
  const riskSectionTitle = isRejected ? "Blocking factors" : "Risks to verify";
  const whyNow = candidate?.whyNow || (isStrong ? "Timing not confirmed but profile fit is strong." : "Timing should be reviewed by the recruiter.");
  const suggestedAngle = candidate?.suggestedAngle || (isRejected ? "None. This profile should not be contacted for this mission." : "Use the mission context as the opening angle.");
  const reason = candidate?.whyThisProfile || (isRejected ? "Profile does not match the mission requirements." : "Profile analysis is being refined.");

  const decisionEvidence = [
    candidate?.currentRole && `Current role: ${candidate.currentRole} at ${candidate.currentCompany}.`,
    companyResearch.summary && `Industry context: ${String(companyResearch.summary).split(".")[0]}.`,
    candidate?.location && `Location: ${candidate.location}.`,
    ...[...facts, ...inferences, ...hypotheses].map(item => pickString(item.evidence, item.label)),
  ].filter((item): item is string => Boolean(item));


  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close analysis panel"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-background/45 backdrop-blur-[2px]"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl">
        <header className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/35">Sourcing analysis</p>
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
            <StatusBadge>{recommendationLabel}</StatusBadge>
            <span className="text-xs text-foreground/40">Fit</span>
            <ScoreBadge value={candidate.fitScore} />
            <span className="text-xs text-foreground/40">Opportunity</span>
            <ScoreBadge value={candidate.opportunityScore} />
            <div className="ml-auto flex items-center gap-6">
              <LinkedInLink url={linkedinUrl} />
              <CVLink url={null} /> {/* Sourcing candidates don't usually have CVs here yet, but keeping the slot for consistency if needed */}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-6">
            <section className="border-t border-border pt-4">
              <div className="divide-y divide-border/70">
                <DetailLine icon={BriefcaseBusiness} label="Current role" value={candidate.currentRole} />
                <DetailLine icon={Building2} label="Current company" value={candidate.currentCompany} />
                <DetailLine icon={MapPin} label="Location" value={candidate.location} />
              </div>
            </section>

            <AnalysisSection title="Decision" icon={Target}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground/45">Recommendation</span>
                  <StatusBadge>{recommendationLabel}</StatusBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground/45">Fit score</span>
                  <ScoreBadge value={candidate.fitScore} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground/45">Opportunity score</span>
                  <ScoreBadge value={candidate.opportunityScore} />
                </div>
              </div>
            </AnalysisSection>

            <AnalysisSection title="Reason" icon={Target}>
              <p className="text-sm leading-6 text-foreground/70">{reason}</p>
            </AnalysisSection>

            {!isRejected && candidate.recommendation ? (
              <AnalysisSection title="Why now" icon={TimerReset}>
                <p className="text-sm leading-6 text-foreground/70">{whyNow}</p>
              </AnalysisSection>
            ) : null}

            <AnalysisSection title="Key signals" icon={Target}>
              <ul className="space-y-2 text-sm leading-6 text-foreground/65">
                {candidate.sourcingSignals.length > 0 ? (
                  candidate.sourcingSignals.map((item) => (
                    <li key={item} className="flex items-start gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                      <span className="mt-2.5 size-1 shrink-0 rounded-full bg-emerald-500" />
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="text-foreground/40 italic">
                    {isStrong ? "Profile has strong mission alignment based on current role and context." : "No positive mission-fit signal was retained for this profile."}
                  </li>
                )}
              </ul>
            </AnalysisSection>

            {candidate.sourcingRisks.length > 0 ? (
              <AnalysisSection title={riskSectionTitle} icon={TimerReset}>
                <ul className="space-y-2 text-sm leading-6 text-foreground/65">
                  {candidate.sourcingRisks.map((item) => (
                    <li key={item} className="flex items-start gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                      <span className="mt-2.5 size-1 shrink-0 rounded-full bg-rose-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </AnalysisSection>
            ) : null}

            {!isRejected ? (
              <AnalysisSection title="Suggested angle" icon={Lightbulb}>
                <p className="text-sm leading-6 text-foreground/70">{suggestedAngle}</p>
              </AnalysisSection>
            ) : null}

            <AnalysisSection title="Company signals" icon={Building2}>
              <div className="space-y-4">
                <p className="text-sm leading-6 text-foreground/70">{companyContextSummary}</p>
                {recentCompanySignals.length > 0 ? (
                  <ul className="space-y-3">
                    {recentCompanySignals.map((signal, i) => (
                      <li key={i} className="flex items-start gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                        <span className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          signal.impact_on_opportunity === "high" ? "bg-emerald-500" :
                          signal.impact_on_opportunity === "medium" ? "bg-amber-500" : "bg-foreground/20"
                        )} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{pickString(signal.label)}</p>
                          </div>
                          <p className="mt-0.5 text-sm leading-5 text-foreground/55">{pickString(signal.description)}</p>
                          {signal.source_url ? (
                            <div className="mt-2 flex items-center gap-3">
                              <a 
                                href={String(signal.source_url)} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-500/80 hover:text-indigo-500 transition-colors"
                              >
                                {pickString(signal.source_title) || "View Source"}
                                <ExternalLink className="size-2.5" />
                              </a>
                              {hostnameLabel(signal.source_url) ? (
                                <span className="rounded bg-secondary/50 px-1.5 py-0.5 text-[10px] font-medium tracking-tight text-foreground/45">
                                  {hostnameLabel(signal.source_url)}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </AnalysisSection>

            {sourceRows.length > 0 ? (
              <AnalysisSection title="Sources checked" icon={Globe}>
                <ul className="space-y-2 text-xs">
                  {(showAllSources ? sourceRows : sourceRows.slice(0, 3)).map((source, i) => {
                    const title = pickString(source.title, source.label, source.url) || "Web result";
                    const url = pickString(source.url);
                    return (
                    <li key={`${title}-${i}`} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <Globe className="size-3 shrink-0 text-foreground/35" />
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-foreground/65 hover:text-foreground">
                            {title}
                          </a>
                        ) : (
                          <span className="truncate font-medium text-foreground/65">{title}</span>
                        )}
                        <span className={cn("shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", sourceBadgeClass(source.source_relevance))}>
                          {sourceBadgeLabel(source.source_relevance)}
                        </span>
                      </div>
                      {pickString(source.reason) ? (
                        <p className="mt-1 pl-5 text-foreground/45">{pickString(source.reason)}</p>
                      ) : null}
                    </li>
                    );
                  })}
                </ul>
                {sourceRows.length > 3 ? (
                  <button 
                    type="button"
                    onClick={() => setShowAllSources(!showAllSources)}
                    className="mt-3 text-xs font-medium text-foreground/35 hover:text-foreground"
                  >
                    {showAllSources ? "Show fewer sources" : `View all ${sourceRows.length} sources`}
                  </button>
                ) : null}
              </AnalysisSection>
            ) : sourceUrls.length > 0 ? (
              <AnalysisSection title="Sources checked" icon={Globe}>
                <ul className="space-y-2">
                  {(showAllSources ? sourceUrls : sourceUrls.slice(0, 3)).map((url, i) => (
                    <li key={i} className="flex items-center gap-2 truncate text-xs text-foreground/45 hover:text-foreground">
                      <Globe className="size-3 shrink-0" />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="truncate">{url}</a>
                    </li>
                  ))}
                </ul>
                {sourceUrls.length > 3 ? (
                  <button 
                    type="button"
                    onClick={() => setShowAllSources(!showAllSources)}
                    className="mt-3 text-xs font-medium text-foreground/35 hover:text-foreground"
                  >
                    {showAllSources ? "Show fewer sources" : `View all ${sourceUrls.length} sources`}
                  </button>
                ) : null}
              </AnalysisSection>
            ) : null}


            <div className="border-t border-border pt-6 text-center">
              <button
                type="button"
                onClick={() => setShowEvidence(!showEvidence)}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-4 text-xs font-medium text-foreground/55 transition hover:bg-secondary hover:text-foreground"
              >
                {showEvidence ? "Hide evidence" : "View evidence"}
              </button>
            </div>

            {showEvidence ? (
              <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                {companyResearch.summary ? (
                  <AnalysisSection title="Company intelligence" icon={Building2}>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/35">Business Summary</p>
                        <p className="mt-1 text-sm leading-6 text-foreground/70">{String(companyResearch.summary)}</p>
                      </div>
                      {companyResearch.market_context ? (
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/35">Market & Positioning</p>
                          <p className="mt-1 text-sm leading-6 text-foreground/70">{String(companyResearch.market_context)}</p>
                        </div>
                      ) : null}
                      {companyResearch.organizational_structure ? (
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/35">Organizational Structure</p>
                          <p className="mt-1 text-sm leading-6 text-foreground/70">{String(companyResearch.organizational_structure)}</p>
                        </div>
                      ) : null}
                    </div>
                  </AnalysisSection>
                ) : null}


                {decisionEvidence.length > 0 ? (
                  <AnalysisSection title="Evidence used for decision" icon={Lightbulb}>
                    <ul className="space-y-2 text-sm leading-6 text-foreground/65">
                      {decisionEvidence.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                          <span className="mt-2.5 size-1 shrink-0 rounded-full bg-foreground/20" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </AnalysisSection>
                ) : null}
              </div>
            ) : null}

          </div>
        </div>
      </aside>
    </div>
  );
}

export function SourcingResultsTable({
  candidates,
}: {
  candidates: SourcingAnalysisCandidate[];
}) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [candidates, selectedCandidateId],
  );

  return (
    <>
      <div className="flex flex-col gap-3">
        {candidates.map((candidate, index) => {
          const isRejected = isRejectedRecommendation(candidate.recommendation);
          
          return (
            <div
              key={candidate.id}
              className="group relative flex items-center gap-6 rounded-2xl border border-white/40 bg-white/40 p-4 pr-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md transition-all duration-300 hover:border-pink-500/20 hover:shadow-[0_20px_40px_rgba(236,72,153,0.08)] cursor-pointer"
              onClick={() => setSelectedCandidateId(candidate.id)}
            >
              {/* Hover Gradient */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-pink-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

              <div className="relative flex flex-1 items-center gap-8">
                {/* Rank Indicator */}
                <div className="flex w-10 items-center justify-center font-black text-foreground/10 group-hover:text-pink-500/20 transition-colors">
                  #{index + 1}
                </div>

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
                    {(candidate.whyThisProfile || candidate.fitScore !== null) && (
                      <>
                        <span className="text-foreground/10 shrink-0">•</span>
                        <div className="max-w-[400px] truncate italic text-foreground/45 font-medium">
                          {candidate.whyThisProfile || "Analysis completed"}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative flex items-center gap-8 shrink-0 pr-4 z-10">
                <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                   <LinkedInLink url={linkedinHref(candidate)} />
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
          );
        })}
      </div>

      <AnalysisDrawer candidate={selectedCandidate} onClose={() => setSelectedCandidateId(null)} />
    </>
  );
}
