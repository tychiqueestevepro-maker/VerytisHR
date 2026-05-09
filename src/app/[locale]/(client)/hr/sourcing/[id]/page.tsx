import { notFound, redirect } from "next/navigation";
import { Brain, FileUp, SearchCheck, Trophy } from "lucide-react";
import { ActionLink, MetricLine, ApplicationTabs, PageHeader, SectionBlock, SourcingTabs, StatusBadge, applicationIcons } from "@/components/hr/application-components";
import { SourcingHeaderActions } from "@/components/hr/sourcing-header-actions";
import { getApplicationWorkspaceData, metadata } from "@/lib/hr/application-workspace";

export default async function SourcingOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const applicationMeta = metadata(data.application);
  if (applicationMeta.workflow_type === "application") {
    redirect(`/hr/applications/${id}`);
  }

  return (
    <div className="mx-auto max-w-screen-2xl">
      <PageHeader
        eyebrow="Sourcing / Outbound"
        title={String(data.application.title ?? "Sourcing Project")}
        actions={<SourcingHeaderActions applicationId={id} />}
        meta={
          <>
            <span>{data.progress.candidatesImported} imported profiles</span>
            <span>{data.progress.analyzed} analyzed</span>
            <span>Avg fit {data.progress.avgFit ?? "-"}</span>
          </>
        }
      />
      <SourcingTabs applicationId={id} active="overview" />

      <div className="grid gap-8 xl:grid-cols-2">
        <SectionBlock title="Sourcing progress" icon={applicationIcons.sourcing}>
          <div className="grid gap-x-8 md:grid-cols-2">
            <MetricLine label="Profiles imported" value={data.progress.candidatesImported} />
            <MetricLine label="LinkedIn verified" value={data.progress.linkedinVerified} />
            <MetricLine label="Analyzed" value={data.progress.analyzed} />
            <MetricLine label="Strong matches" value={data.summary.strongMatches} />
            <MetricLine label="Review needed" value={data.summary.reviewNeeded} />
            <MetricLine label="Low fit" value={data.summary.rejected} />
          </div>
        </SectionBlock>

        <SectionBlock title="Next actions">
          <div className="flex flex-wrap gap-2">
            <ActionLink href={`/hr/sourcing/${id}/candidates`} icon={SearchCheck} variant="secondary">Verify profiles</ActionLink>
            <ActionLink href={`/hr/sourcing/${id}/candidates`} icon={Brain} variant="secondary">Analyze talent pool</ActionLink>
            <ActionLink href={`/hr/sourcing/${id}/results`} icon={Trophy}>Open sourcing results</ActionLink>
          </div>
        </SectionBlock>

        <SectionBlock title="Sourcing alerts" icon={applicationIcons.alerts}>
          <div className="divide-y divide-border/70">
            {data.alerts.map((alert) => (
              <div key={alert.label} className="flex min-h-12 items-center justify-between gap-4 py-3">
                <span className={alert.active ? "text-sm text-foreground" : "text-sm text-foreground/40"}>{alert.label}</span>
                <StatusBadge>{alert.active ? "Review" : "Completed"}</StatusBadge>
              </div>
            ))}
          </div>
        </SectionBlock>
      </div>
    </div>
  );
}
