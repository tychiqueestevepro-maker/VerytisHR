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
import { ApplicationStatusToggle } from "@/components/hr/application-status-toggle";
import { cn } from "@/lib/utils";
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
        eyebrow="Recruitment Cockpit"
        title={String(data.application.title ?? "Application")}
        actions={
          <div className="flex items-center gap-3">
             <ApplicationStatusToggle applicationId={id} currentStatus={data.status} />
          </div>
        }
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <Inbox className="size-3.5 text-pink-500" />
              {data.sessions.length} application sessions
            </span>
            <span className="flex items-center gap-1.5">
              <Link2 className="size-3.5 text-foreground/40" />
              {data.progress.responsesReceived} responses received
            </span>
          </>
        }
      />
      <ApplicationTabs applicationId={id} active="overview" workflowType={workflowType} />

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          <SectionBlock title="Job context" icon={applicationIcons.overview}>
            <div className="grid gap-x-10 md:grid-cols-2">
              <MetricLine label="Title" value={String(data.application.title ?? "-")} />
              <MetricLine label="Location" value={String(data.application.location ?? data.application.remote_policy ?? "-")} />
              <MetricLine label="Seniority" value={String(applicationMeta.seniority ?? "-")} />
              <MetricLine label="Salary" value={salaryLabel(data.application)} />
              <MetricLine label="Team" value={String(data.application.department ?? "-")} />
            </div>
          </SectionBlock>

          <SectionBlock title="Main criteria">
            <div className="grid gap-8">
              <div>
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Must-have skills</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(applicationMeta.must_have_skills) ? applicationMeta.must_have_skills : []).map((skill: string) => (
                    <span key={skill} className="rounded-lg border border-pink-500/10 bg-pink-500/5 px-2.5 py-1.5 text-[11px] font-bold text-pink-700 shadow-sm transition-all hover:bg-pink-500/10">
                      {skill}
                    </span>
                  ))}
                  {(!Array.isArray(applicationMeta.must_have_skills) || applicationMeta.must_have_skills.length === 0) && <span className="text-sm text-foreground/30">-</span>}
                </div>
              </div>
              
              <div>
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Nice-to-have skills</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(applicationMeta.nice_to_have_skills) ? applicationMeta.nice_to_have_skills : []).map((skill: string) => (
                    <span key={skill} className="rounded-lg border border-black/[0.06] bg-black/[0.03] px-2.5 py-1.5 text-[11px] font-bold text-foreground/60 shadow-sm transition-all hover:bg-black/[0.06]">
                      {skill}
                    </span>
                  ))}
                  {(!Array.isArray(applicationMeta.nice_to_have_skills) || applicationMeta.nice_to_have_skills.length === 0) && <span className="text-sm text-foreground/30">-</span>}
                </div>
              </div>

              <div className="grid gap-8 md:grid-cols-2 pt-4 border-t border-black/[0.03]">
                <div>
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Pain / challenge</p>
                  <p className="text-[13px] leading-relaxed text-foreground/70 font-medium">{String(applicationMeta.pain_challenge ?? "-")}</p>
                </div>
                <div>
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Difficulty level</p>
                  <p className="text-[13px] leading-relaxed text-foreground/70 font-medium italic">{String(applicationMeta.difficulty_level ?? "-")}</p>
                </div>
              </div>
            </div>
          </SectionBlock>
        </div>

        <div className="space-y-8">
          {workflowType === "application" ? (
            <SectionBlock title="Applications progress" icon={applicationIcons.applications}>
              <div className="grid gap-1">
                <MetricLine label="Pipeline generated" value={data.pipeline ? "Yes" : "No"} />
                <MetricLine label="Apply link" value={data.pipeline ? "Ready" : "Generate pipeline"} />
                <MetricLine label="Questions" value={data.questions.length} />
                <MetricLine label="Applications received" value={data.sessions.length} />
                <MetricLine
                  label="CV parsed"
                  value={`${data.applicationSessions.filter((s) => s.cvStatus === "Parsed").length} / ${data.sessions.length}`}
                />
                <MetricLine
                  label="LinkedIn checked"
                  value={`${data.applicationSessions.filter((s) => s.linkedinStatus === "Verified").length} / ${data.sessions.length}`}
                />
                <MetricLine
                  label="Responses analyzed"
                  value={`${data.applicationSessions.filter((s) => s.pipelineScore !== null).length} / ${data.sessions.length}`}
                />
              </div>
            </SectionBlock>
          ) : (
            <SectionBlock title="Team context" icon={applicationIcons.progress}>
              <div className="grid gap-1">
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
        </div>
      </div>
    </div>
  );
}
