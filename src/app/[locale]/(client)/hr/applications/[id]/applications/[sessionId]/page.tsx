import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2, XCircle, Linkedin } from "lucide-react";
import { ApplicationTabs, PageHeader, PlainButton, ScoreBadge, SectionBlock, StatusBadge, LinkedinBadge } from "@/components/hr/application-components";
import { AnalysisButton } from "@/components/hr/analysis-button";
import { getApplicationWorkspaceData } from "@/lib/hr/application-workspace";
import { pickString } from "@/lib/hr/utils";
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
            <ScoreBadge value={application.pipelineScore} />
          </>
        }
        actions={
          <div className="flex items-center gap-6">
             <span className="text-sm font-medium text-foreground/40">{application.subtitle}</span>
             <LinkedinBadge url={application.linkedinUrl} />
          </div>
        }
      />
      <ApplicationTabs applicationId={id} active="sessions" />

      {/* 1. Decision Section */}
      <section className="mb-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex size-12 items-center justify-center rounded-full border-4",
              isAdvance ? "border-emerald-100 bg-emerald-50 text-emerald-600" :
              isRejected || application.integrityStatus === "Review needed" ? "border-rose-100 bg-rose-50 text-rose-600" :
              "border-amber-100 bg-amber-50 text-amber-600"
            )}>
              {isAdvance ? <CheckCircle2 className="size-6" /> :
               isRejected || application.integrityStatus === "Review needed" ? <XCircle className="size-6" /> :
               <AlertCircle className="size-6" />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">Decision</p>
              <h2 className="text-xl font-bold text-foreground">
                {isRejected ? "Reject / Invalid application" : 
                 application.integrityStatus === "Review needed" ? "Reject / Review needed" :
                 isAdvance ? "Advance / Strong match" : 
                 application.recommendation || "Manual review required"}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 md:gap-8">
            <div className="text-center md:text-left">
              <p className="text-xs font-medium text-foreground/40">Pipeline score</p>
              <p className={cn("text-lg font-bold", (application.pipelineScore ?? 0) < 40 ? "text-rose-600" : "text-foreground")}>
                {application.pipelineScore ?? "-"}
              </p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-xs font-medium text-foreground/40">Integrity</p>
              <p className={cn("text-lg font-bold", application.integrityStatus === "Review needed" ? "text-rose-600" : "text-emerald-600")}>
                {application.integrityStatus}
              </p>
            </div>
          </div>
          
          {isPending && (
            <div className="ml-auto">
               <AnalysisButton token={String(application.session?.public_token || "")} />
            </div>
          )}
        </div>

        {(application.flagReason || application.isHighUnusable) && (
          <div className="mt-6 rounded-lg bg-rose-50/50 p-4 border border-rose-100">
            <p className="text-sm font-semibold text-rose-900">Reason:</p>
            <p className="mt-1 text-sm leading-6 text-rose-700">
              {application.flagReason}
            </p>
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* 2. Scores Section */}
        <SectionBlock title="Scores">
          <div className="space-y-3 text-sm text-foreground/65">
            <p className="flex items-center justify-between"><span>Pipeline score</span><ScoreBadge value={application.pipelineScore} /></p>
            <p className="flex items-center justify-between">
              <span>Fit score</span>
              {application.fitScoreLabel ? (
                <span className="text-rose-600 font-semibold">{application.fitScoreLabel}</span>
              ) : (
                <ScoreBadge value={application.fitScore} />
              )}
            </p>
            <p className="flex items-center justify-between"><span>Team fit</span><ScoreBadge value={application.teamFitScore} /></p>
            <p className="flex items-center justify-between"><span>LinkedIn coherence</span><StatusBadge>{application.linkedinCvCoherence}</StatusBadge></p>
            {application.linkedinUrl && (
              <p className="flex items-center justify-between">
                <span>LinkedIn URL</span>
                <a href={application.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[150px]">
                  {application.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </p>
            )}
            <p className="flex items-center justify-between pt-2 border-t border-border/50"><span>Completion</span><span>{application.completionLabel}</span></p>
            <p className="flex items-center justify-between"><span>Status</span><StatusBadge>{application.responseStatus}</StatusBadge></p>
            <p className="flex items-center justify-between"><span>CV</span><StatusBadge>{application.cvStatus}</StatusBadge></p>
          </div>
        </SectionBlock>

        {/* 3. Integrity Section */}
        <SectionBlock title="Assessment integrity">
          <div className="space-y-3 text-sm text-foreground/65">
            <p className="flex items-center justify-between">
              <span>Status</span>
              <StatusBadge>{isPending ? "Analysis Pending" : application.integrityStatus}</StatusBadge>
            </p>
            <p className="flex items-center justify-between"><span>Paste/copy attempts</span><span>{application.pasteAttempts}</span></p>
            <p className="flex items-center justify-between"><span>Tab switches</span><span>{application.tabSwitches}</span></p>
            <p className="flex items-center justify-between"><span>Average time</span><span>{application.averageTimePerAnswer ? `${application.averageTimePerAnswer}s` : "-"}</span></p>
            {application.flagReason ? (
              <div className="mt-3 border-t border-border/50 pt-3">
                <p className="text-xs font-semibold text-foreground/40 uppercase mb-1">Observation</p>
                <p className="leading-5 text-foreground/65">{application.flagReason}</p>
              </div>
            ) : null}
          </div>
        </SectionBlock>

        <div className="lg:col-span-1 space-y-8">
           {/* Strengths */}
          <SectionBlock title="Strengths">
            <ul className="space-y-2 text-sm leading-6 text-foreground/65">
              {application.strengths.length > 0 ? (
                application.strengths.map((item) => <li key={item}>- {item}</li>)
              ) : (
                <li className="text-foreground/40 italic">No analysis yet.</li>
              )}
            </ul>
          </SectionBlock>

          {/* Risks */}
          <SectionBlock title="Risks">
            <ul className="space-y-2 text-sm leading-6 text-foreground/65">
              {application.risks.length > 0 ? (
                application.risks.map((item) => <li key={item} className={cn(application.isHighUnusable && "text-rose-600/80 font-medium")}>- {item}</li>)
              ) : (
                <li className="text-foreground/40 italic">No analysis yet.</li>
              )}
            </ul>
          </SectionBlock>
        </div>

        {/* Analysis Detail */}
        {pickString(application.score?.analysis) ? (
          <section className="border-t border-border pt-4 lg:col-span-3">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Analysis summary</h2>
            <p className="text-sm leading-6 text-foreground/65">{pickString(application.score?.analysis)}</p>
          </section>
        ) : null}

        {/* 6. Candidate responses */}
        <section className="border-t border-border pt-4 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Candidate responses</h2>
          {application.responses.length ? (
            <div className="space-y-5">
              {application.responses.map((item, index) => (
                <div key={String(item.response.id ?? index)} className="border-t border-border/70 pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-foreground">{item.questionLabel}</p>
                    {item.isUnusable && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                        {item.unusableReason}
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    "mt-2 whitespace-pre-wrap text-sm leading-6",
                    item.isUnusable ? "text-rose-600/70" : "text-foreground/65"
                  )}>
                    {item.responseText}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground/50">No responses submitted yet.</p>
          )}
        </section>

        {/* Suggested Next Step */}
        <section className="mt-12 border-t-2 border-border pt-8 lg:col-span-3">
           <div className="rounded-xl bg-foreground text-background p-6 shadow-lg">
             <div className="flex items-center gap-3 mb-4">
               <AlertCircle className="size-5 text-amber-400" />
               <h3 className="text-lg font-bold">Suggested next step</h3>
             </div>
             <p className="text-sm leading-6 opacity-90">
               {isRejected || application.integrityStatus === "Review needed" ? 
                "REJECT : The application integrity is compromised. We recommend rejecting this candidate directly to save time, unless you wish to manually audit their CV for exceptional cases." :
                isAdvance ? 
                "ADVANCE : High-quality application with strong role fit. Move this candidate to the interview stage immediately." :
                "REVIEW : Manual profile audit required to determine whether the candidate matches the team's technical expectations."}
             </p>
             <div className="mt-6 flex gap-3">
               <PlainButton className="bg-background text-foreground hover:bg-background/90 border-0">
                 Reject candidate
               </PlainButton>
               {isAdvance && (
                 <PlainButton className="bg-emerald-500 text-white hover:bg-emerald-600 border-0">
                   Move to interview
                 </PlainButton>
               )}
             </div>
           </div>
        </section>
      </div>
    </div>
  );
}
