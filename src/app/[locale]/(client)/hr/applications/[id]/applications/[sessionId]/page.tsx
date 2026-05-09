import { notFound } from "next/navigation";
import { ApplicationsTabs, ApplicationTabs, PageHeader, ScoreBadge, SectionBlock, StatusBadge } from "@/components/hr/application-components";
import { getApplicationWorkspaceData } from "@/lib/hr/application-workspace";
import { pickString } from "@/lib/hr/utils";

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

  return (
    <div className="mx-auto max-w-7xl">
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
      />
      <ApplicationTabs applicationId={id} active="applications" />
      <ApplicationsTabs applicationId={id} active="sessions" />

      <div className="grid gap-8 lg:grid-cols-3">
        <SectionBlock title="Application summary">
          <div className="space-y-3 text-sm text-foreground/65">
            <p className="flex items-center justify-between"><span>Status</span><StatusBadge>{application.responseStatus}</StatusBadge></p>
            <p className="flex items-center justify-between"><span>Pipeline score</span><ScoreBadge value={application.pipelineScore} /></p>
            <p className="flex items-center justify-between"><span>Fit score</span><ScoreBadge value={application.fitScore} /></p>
            <p className="flex items-center justify-between"><span>Trust score</span><ScoreBadge value={application.trustScore} /></p>
            <p className="flex items-center justify-between"><span>Team fit</span><ScoreBadge value={application.teamFitScore} /></p>
            <p className="flex items-center justify-between"><span>CV</span><StatusBadge>{application.cvStatus}</StatusBadge></p>
            <p className="flex items-center justify-between"><span>LinkedIn coherence</span><StatusBadge>{application.linkedinCvCoherence}</StatusBadge></p>
          </div>
        </SectionBlock>

        <SectionBlock title="Strengths">
          <ul className="space-y-2 text-sm leading-6 text-foreground/65">
            {application.strengths.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </SectionBlock>

        <SectionBlock title="Risks">
          <ul className="space-y-2 text-sm leading-6 text-foreground/65">
            {application.risks.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </SectionBlock>

        <section className="border-t border-border pt-4 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Candidate responses</h2>
          {application.responses.length ? (
            <div className="space-y-5">
              {application.responses.map((item, index) => (
                <div key={String(item.response.id ?? index)} className="border-t border-border/70 pt-4">
                  <p className="text-sm font-medium text-foreground">{item.questionLabel}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/65">{item.responseText}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground/50">No responses submitted yet.</p>
          )}
        </section>

        {pickString(application.score?.analysis) ? (
          <section className="border-t border-border pt-4 lg:col-span-3">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Analysis</h2>
            <p className="text-sm leading-6 text-foreground/65">{pickString(application.score?.analysis)}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
