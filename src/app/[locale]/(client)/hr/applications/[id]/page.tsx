import { notFound, redirect } from "next/navigation";
import { Inbox, Link2, Search } from "lucide-react";
import {
  ActionLink,
  MetricLine,
  ApplicationTabs,
  PageHeader,
  SectionBlock,
  StatusBadge,
  applicationIcons,
} from "@/components/hr/application-components";
import { getApplicationWorkspaceData, metadata, salaryLabel } from "@/lib/hr/application-workspace";

export default async function ApplicationOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const applicationMeta = metadata(data.application);
  const workflowType = applicationMeta.workflow_type === "sourcing" ? "sourcing" : "application";

  if (applicationMeta.workflow_type === "sourcing") {
    redirect(`/hr/sourcing/${id}`);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Recruitment"
        title={String(data.application.title ?? "Application")}
        meta={
          <>
            <StatusBadge>{data.status}</StatusBadge>
            <span>{data.progress.candidatesImported} sourced profiles</span>
            <span>{data.sessions.length} application sessions</span>
          </>
        }
      />
      <ApplicationTabs applicationId={id} active="overview" workflowType={workflowType} />

      <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
        <SectionBlock title="Job context" icon={applicationIcons.overview}>
          <div className="grid gap-x-8 md:grid-cols-2">
            <MetricLine label="Title" value={String(data.application.title ?? "-")} />
            <MetricLine label="Location" value={String(data.application.location ?? data.application.remote_policy ?? "-")} />
            <MetricLine label="Seniority" value={String(applicationMeta.seniority ?? "-")} />
            <MetricLine label="Salary" value={salaryLabel(data.application)} />
            <MetricLine label="Team" value={String(data.application.department ?? "-")} />
            <MetricLine label="Status" value={<StatusBadge>{data.status}</StatusBadge>} />
          </div>
        </SectionBlock>

        {workflowType === "application" ? (
          <SectionBlock title="Applications progress" icon={applicationIcons.applications}>
            <div className="grid gap-x-8 md:grid-cols-2">
              <MetricLine label="Pipeline generated" value={data.pipeline ? "Yes" : "No"} />
              <MetricLine label="Apply link" value={data.pipeline ? "Ready" : "Generate pipeline"} />
              <MetricLine label="Questions" value={data.questions.length} />
              <MetricLine label="Applications received" value={data.sessions.length} />
              <MetricLine
                label="CV parsed"
                value={data.applicationSessions.filter((s) => s.cvStatus === "Parsed").length}
              />
              <MetricLine
                label="LinkedIn checked"
                value={data.applicationSessions.filter((s) => s.linkedinStatus === "Verified").length}
              />
              <MetricLine
                label="Responses analyzed"
                value={data.applicationSessions.filter((s) => s.pipelineScore !== null).length}
              />
            </div>
          </SectionBlock>
        ) : (
          <SectionBlock title="Team context" icon={applicationIcons.progress}>
            <div className="grid gap-x-8 md:grid-cols-2">
              <MetricLine label="Company context" value={String(applicationMeta.company_context ?? "-")} />
              <MetricLine label="Current situation" value={String(applicationMeta.current_situation ?? "-")} />
              <MetricLine label="Hiring goal" value={String(applicationMeta.hiring_goal ?? "-")} />
              <MetricLine label="Team workflow" value={String(applicationMeta.team_workflow ?? "-")} />
              <MetricLine label="Previous work" value={String(applicationMeta.previous_team_work ?? "-")} />
              <MetricLine label="Work samples" value={data.workSamples.length ? `${data.workSamples.length} stored sample${data.workSamples.length > 1 ? "s" : ""}` : String(applicationMeta.work_samples ?? "-")} />
              <MetricLine label="Manager expectations" value={String(applicationMeta.manager_expectations ?? "-")} />
              <MetricLine label="Success criteria" value={String(applicationMeta.success_criteria ?? "-")} />
            </div>
          </SectionBlock>
        )}

        <SectionBlock title="Main criteria">
          <div className="grid gap-x-8 md:grid-cols-2">
            <MetricLine label="Must-have skills" value={Array.isArray(applicationMeta.must_have_skills) ? applicationMeta.must_have_skills.join(", ") || "-" : "-"} />
            <MetricLine label="Nice-to-have skills" value={Array.isArray(applicationMeta.nice_to_have_skills) ? applicationMeta.nice_to_have_skills.join(", ") || "-" : "-"} />
            <MetricLine label="Pain / challenge" value={String(applicationMeta.pain_challenge ?? "-")} />
            <MetricLine label="Difficulty" value={String(applicationMeta.difficulty_level ?? "-")} />
          </div>
        </SectionBlock>

        <SectionBlock title="Flow Status">
          <div className="grid gap-4">
            {applicationMeta.workflow_type === "sourcing" ? (
              <div className="border-t border-border pt-4">
                <Search className="mb-3 size-4 text-foreground/45" />
                <h2 className="text-sm font-semibold text-foreground">Sourcing / Outbound</h2>
                <p className="mt-2 text-sm leading-6 text-foreground/50">
                  Profiles imported by the recruiter, then qualified to decide who should be contacted first.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground/55">
                  <span>{data.progress.candidatesImported} profiles</span>
                  <span>{data.progress.analyzed} analyzed</span>
                  <span>Avg fit {data.progress.avgFit ?? "-"}</span>
                </div>
                <div className="mt-4">
                  <ActionLink href={`/hr/sourcing/${id}/candidates`} icon={Search}>Open sourcing results</ActionLink>
                </div>
              </div>
            ) : (
              <div className="border-t border-border pt-4">
                <Inbox className="mb-3 size-4 text-foreground/45" />
                <h2 className="text-sm font-semibold text-foreground">Applications / Inbound</h2>
                <p className="mt-2 text-sm leading-6 text-foreground/50">
                  Candidates apply through a public pipeline link, answer contextual questions, then get evaluated.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground/55">
                  <span>{data.sessions.length} sessions</span>
                  <span>{data.progress.responsesReceived} responses</span>
                  <span>{data.questions.length} questions</span>
                </div>
                <div className="mt-4 flex gap-3">
                  <ActionLink href={`/hr/applications/${id}/applications/results`} icon={Inbox}>Results</ActionLink>
                  <ActionLink href={`/hr/applications/${id}/applications/pipeline`} icon={Link2} variant="secondary">Check pipeline</ActionLink>
                </div>
              </div>
            )}
          </div>
        </SectionBlock>
      </div>
    </div>
  );
}
