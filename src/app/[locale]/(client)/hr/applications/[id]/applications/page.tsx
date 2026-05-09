import { notFound } from "next/navigation";
import { Inbox, Link2, Trophy } from "lucide-react";
import { ActionLink, ApplicationsTabs, MetricLine, ApplicationTabs, PageHeader, SectionBlock, StatusBadge, applicationIcons } from "@/components/hr/application-components";
import { getApplicationWorkspaceData } from "@/lib/hr/application-workspace";

export default async function ApplicationsOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const scoredApplications = data.applicationSessions.filter((session) => session.pipelineScore !== null).length;
  const cvParsed = data.applicationSessions.filter((session) => session.cvStatus === "Parsed").length;
  const linkedinChecked = data.applicationSessions.filter((session) => session.linkedinStatus === "Verified").length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Applications / Inbound"
        title={String(data.application.title ?? "Application")}
        meta={
          <>
            <span>{data.sessions.length} sessions</span>
            <span>{data.progress.responsesReceived} responses received</span>
            <span>{scoredApplications} scored</span>
          </>
        }
      />
      <ApplicationTabs applicationId={id} active="applications" />
      <ApplicationsTabs applicationId={id} active="overview" />

      <div className="grid gap-8 xl:grid-cols-2">
        <SectionBlock title="Applications progress" icon={applicationIcons.applications}>
          <div className="grid gap-x-8 md:grid-cols-2">
            <MetricLine label="Pipeline generated" value={data.pipeline ? "Yes" : "No"} />
            <MetricLine label="Apply link" value={data.pipeline ? "Ready" : "Generate pipeline"} />
            <MetricLine label="Questions" value={data.questions.length} />
            <MetricLine label="Applications received" value={data.sessions.length} />
            <MetricLine label="CV parsed" value={cvParsed} />
            <MetricLine label="LinkedIn checked" value={linkedinChecked} />
            <MetricLine label="Responses analyzed" value={scoredApplications} />
          </div>
        </SectionBlock>

        <SectionBlock title="Next actions">
          <div className="flex flex-wrap gap-2">
            <ActionLink href={`/hr/applications/${id}/applications/pipeline`} icon={Link2}>Open pipeline</ActionLink>
            <ActionLink href={`/hr/applications/${id}/applications/sessions`} icon={Inbox} variant="secondary">View sessions</ActionLink>
            <ActionLink href={`/hr/applications/${id}/applications/results`} icon={Trophy} variant="secondary">Application results</ActionLink>
          </div>
        </SectionBlock>

        <SectionBlock title="Inbound status" icon={applicationIcons.alerts}>
          <div className="divide-y divide-border/70">
            <div className="flex min-h-12 items-center justify-between gap-4 py-3">
              <span className="text-sm text-foreground/65">Pipeline readiness</span>
              <StatusBadge>{data.pipeline ? "Ready" : "Draft"}</StatusBadge>
            </div>
            <div className="flex min-h-12 items-center justify-between gap-4 py-3">
              <span className="text-sm text-foreground/65">Candidate responses</span>
              <StatusBadge>{data.progress.responsesReceived > 0 ? "Active" : "Pending"}</StatusBadge>
            </div>
          </div>
        </SectionBlock>
      </div>
    </div>
  );
}
