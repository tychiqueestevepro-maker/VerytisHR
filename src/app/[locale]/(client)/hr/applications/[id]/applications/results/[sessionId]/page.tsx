import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2, XCircle, Clock, User, Trophy, Sparkles } from "lucide-react";
import { ApplicationTabs, PageHeader, PlainButton, ScoreBadge, SectionBlock, StatusBadge, LinkedInLink, CVLink, EmptyState, MetricLine, applicationIcons } from "@/components/hr/application-components";
import { AnalysisButton } from "@/components/hr/analysis-button";
import { getApplicationWorkspaceData } from "@/lib/hr/application-workspace";
import { pickString, relativeTime } from "@/lib/hr/utils";
import { cn } from "@/lib/utils";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const application = data.applicationSessions.find((item) => item.id === sessionId);
  if (!application) notFound();

  const isPending = application.analysisStatus === "Pending";
  const isRejected = application.recommendation === "Reject";
  const isAdvance = application.recommendation === "Advance" || application.recommendation === "Strong match";

  return (
    <div className="mx-auto max-w-7xl pb-20">
      <PageHeader
        eyebrow="Application detail"
        title={application.name}
        meta={
          <>
            <StatusBadge>{application.responseStatus}</StatusBadge>
            <span>{application.completion}% completion</span>
            <span className="text-foreground/10">•</span>
            <span className="text-foreground/40">{application.subtitle}</span>
          </>
        }
        actions={
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3 pr-6 border-r border-black/[0.05]">
               <LinkedInLink url={pickString(application.linkedinUrl)} />
               <CVLink url={pickString(application.cvUrl)} />
             </div>
             <AnalysisButton token={String(application.session?.public_token || "")} />
          </div>
        }
      />
      <ApplicationTabs applicationId={id} active="results" />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          {/* 1. Decision & Summary */}
          <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/40 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] backdrop-blur-xl">
            <div className="absolute right-0 top-0 h-32 w-32 translate-x-12 -translate-y-12 rounded-full bg-pink-500/5 blur-3xl" />
            
            <div className="relative flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-6">
                <div className={cn(
                  "flex size-16 shrink-0 items-center justify-center rounded-2xl border-2 shadow-sm",
                  isAdvance ? "border-emerald-200 bg-emerald-50 text-emerald-600" :
                  isRejected || application.integrityStatus === "Review needed" ? "border-rose-200 bg-rose-50 text-rose-600" :
                  "border-amber-200 bg-amber-50 text-amber-600"
                )}>
                  {isAdvance ? <CheckCircle2 className="size-8" /> :
                   isRejected || application.integrityStatus === "Review needed" ? <XCircle className="size-8" /> :
                   <AlertCircle className="size-8" />}
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">AI Evaluation</p>
                  <h2 className="text-2xl font-black tracking-tight text-foreground">
                    {isRejected ? "Reject candidate" : 
                     application.integrityStatus === "Review needed" ? "Review needed / Flags detected" :
                     isAdvance ? "Advance candidate" : 
                     application.recommendation || "Manual review required"}
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-foreground/60 max-w-xl">
                    {pickString(application.score?.analysis) || "Waiting for deep analysis to generate strengths, risks and final recommendation."}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/25">Pipeline Score</span>
                <div className={cn(
                  "text-4xl font-black tracking-tighter",
                  (application.pipelineScore ?? 0) >= 80 ? "text-emerald-600" :
                  (application.pipelineScore ?? 0) >= 60 ? "text-amber-600" :
                  "text-rose-600"
                )}>
                  {application.pipelineScore ?? "-"}
                </div>
              </div>
            </div>

            {(application.flagReason || application.isHighUnusable) && (
              <div className="mt-8 rounded-2xl bg-rose-50/50 p-5 border border-rose-100/50">
                <div className="flex items-center gap-2 mb-2 text-rose-900">
                  <AlertCircle className="size-4" />
                  <span className="text-xs font-black uppercase tracking-wider">Critical Observation</span>
                </div>
                <p className="text-[13px] leading-relaxed text-rose-700/80 font-medium">
                  {application.flagReason}
                </p>
              </div>
            )}
          </section>

          {/* 2. Analysis Detail */}
          <div className="grid gap-8 md:grid-cols-2">
            <SectionBlock title="Strengths" icon={CheckCircle2}>
              <ul className="space-y-3">
                {application.strengths.length > 0 ? (
                  application.strengths.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[13px] font-medium leading-relaxed text-foreground/70">
                      <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500/40" />
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="text-[13px] italic text-foreground/30">No strengths identified yet.</li>
                )}
              </ul>
            </SectionBlock>

            <SectionBlock title="Risks & Verifications" icon={AlertCircle}>
              <ul className="space-y-3">
                {application.risks.length > 0 ? (
                  application.risks.map((item) => (
                    <li key={item} className={cn(
                      "flex items-start gap-3 text-[13px] font-medium leading-relaxed",
                      application.isHighUnusable ? "text-rose-600/80" : "text-foreground/70"
                    )}>
                      <div className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", application.isHighUnusable ? "bg-rose-500/40" : "bg-amber-500/40")} />
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="text-[13px] italic text-foreground/30">No major risks detected.</li>
                )}
              </ul>
            </SectionBlock>
          </div>

          {/* 3. Candidate Responses */}
          <SectionBlock title="Work Evidence & Responses" icon={applicationIcons.file}>
            {application.responses.length ? (
              <div className="divide-y divide-black/[0.04]">
                {application.responses.map((item, index) => (
                  <div key={String(item.response.id ?? index)} className="py-6 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-6 mb-3">
                      <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-foreground/40">
                        {item.questionLabel}
                      </h4>
                      {item.isUnusable && (
                        <StatusBadge>{item.unusableReason}</StatusBadge>
                      )}
                    </div>
                    <div className={cn(
                      "relative rounded-2xl border p-5 transition-colors",
                      item.isUnusable 
                        ? "border-rose-100 bg-rose-50/30 text-rose-700/70" 
                        : "border-black/[0.03] bg-black/[0.01] text-foreground/70"
                    )}>
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed font-medium">
                        {item.responseText}
                      </p>
                      <div className="absolute bottom-3 right-4 text-[9px] font-black uppercase tracking-widest text-foreground/15">
                        {Math.round((numberValue(item.response.time_spent_seconds) || 0) / 60)} min spent
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No responses submitted yet" detail="Candidate hasn't completed the pipeline steps." />
            )}
          </SectionBlock>
        </div>

        {/* Sidebar: Technical metrics */}
        <div className="space-y-8">
          <SectionBlock title="Scoring Engine" icon={Trophy}>
            <div className="space-y-0.5">
              <MetricLine label="Pipeline Score" value={<ScoreBadge value={application.pipelineScore} />} />
              <MetricLine label="Role Fit" value={application.fitScoreLabel ? <span className="text-rose-600 font-bold uppercase text-[10px] tracking-wider">{application.fitScoreLabel}</span> : <ScoreBadge value={application.fitScore} />} />
              <MetricLine label="Team Coherence" value={<ScoreBadge value={application.teamFitScore} />} />
              <MetricLine label="LinkedIn Sync" value={<StatusBadge>{application.linkedinCvCoherence}</StatusBadge>} />
            </div>
          </SectionBlock>

          <SectionBlock title="Audit & Integrity" icon={Clock}>
            <div className="space-y-0.5">
              <MetricLine label="Analysis" value={<StatusBadge>{isPending ? "Pending" : application.integrityStatus}</StatusBadge>} />
              <MetricLine label="Paste count" value={application.pasteAttempts} />
              <MetricLine label="Tab switches" value={application.tabSwitches} />
              <MetricLine label="Avg time / q" value={application.averageTimePerAnswer ? `${application.averageTimePerAnswer}s` : "-"} />
            </div>
            {application.flagReason && (
              <div className="mt-4 border-t border-black/[0.03] pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-foreground/20 mb-2">Technical Flag</p>
                <p className="text-[12px] leading-relaxed text-foreground/50 font-medium italic">{application.flagReason}</p>
              </div>
            )}
          </SectionBlock>

          <SectionBlock title="Profile Links" icon={User}>
            <div className="space-y-0.5">
              <MetricLine label="Status" value={<StatusBadge>{application.responseStatus}</StatusBadge>} />
              <MetricLine label="CV State" value={<StatusBadge>{application.cvStatus}</StatusBadge>} />
              <MetricLine label="LinkedIn" value={application.linkedinUrl ? <a href={application.linkedinUrl} target="_blank" rel="noreferrer" className="text-pink-600 hover:underline">View profile</a> : "-"} />
            </div>
          </SectionBlock>

          {/* Action Card */}
          <div className="rounded-3xl bg-foreground p-6 text-background shadow-xl ring-1 ring-white/10">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-xl bg-white/10 text-pink-400">
                <Sparkles className="size-4" />
              </div>
              <h3 className="text-sm font-bold tracking-tight">Next Step</h3>
            </div>
            <p className="mb-6 text-[13px] leading-relaxed opacity-70 font-medium">
              {isRejected || application.integrityStatus === "Review needed" ? 
               "Integrity flags detected. We recommend rejecting this candidate directly." :
               isAdvance ? 
               "Strong work evidence. Move this candidate to interview stage immediately." :
               "Manual audit required to verify specific skills against team needs."}
            </p>
            <div className="flex flex-col gap-2">
              <PlainButton className="w-full bg-white/10 text-white border-0 hover:bg-white/20">
                Reject candidate
              </PlainButton>
              {isAdvance && (
                <PlainButton className="w-full bg-pink-500 text-white border-0 hover:bg-pink-600">
                  Advance to Interview
                </PlainButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
