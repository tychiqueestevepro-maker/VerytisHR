import { notFound } from "next/navigation";
import { Archive, SlidersHorizontal } from "lucide-react";
import { ArchiveApplicationButton } from "@/components/hr/archive-application-button";
import { ActionLink, MetricLine, SourcingTabs, PageHeader, SectionBlock, StatusBadge, applicationIcons } from "@/components/hr/application-components";
import { ApplicationStatusToggle } from "@/components/hr/application-status-toggle";
import { MissionManagerForm } from "@/components/hr/mission-manager-form";
import { getApplicationWorkspaceData, metadata, salaryLabel } from "@/lib/hr/application-workspace";
import { pickString } from "@/lib/hr/utils";

function booleanLabel(value: unknown) {
  return value === true ? "Yes" : "No";
}

export default async function SourcingSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const applicationMeta = metadata(data.application);

  return (
    <div className="mx-auto max-w-screen-2xl">
      <PageHeader
        eyebrow="Sourcing settings"
        title={String(data.application.title ?? "Sourcing Project")}
        actions={
          <div className="flex items-center gap-2">
            <ApplicationStatusToggle applicationId={id} currentStatus={data.status} />
            <ActionLink href={`/hr/sourcing/${id}/edit`} icon={SlidersHorizontal} variant="pink">Modify</ActionLink>
          </div>
        }
        meta={
          <>
            <span>Created {data.application.created_at ? new Date(String(data.application.created_at)).toLocaleDateString() : "-"}</span>
            <span>Last updated {data.application.updated_at ? new Date(String(data.application.updated_at)).toLocaleDateString() : "-"}</span>
          </>
        }
      />
      <SourcingTabs applicationId={id} active="settings" />

      <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <SectionBlock title="Project info" icon={applicationIcons.settings}>
            <div className="grid gap-x-8 md:grid-cols-2">
              <MetricLine label="Title" value={String(data.application.title ?? "-")} />
              <MetricLine label="Location" value={String(data.application.location ?? "-")} />
              <MetricLine label="Salary" value={salaryLabel(data.application)} />
              <MetricLine label="Work mode" value={String(data.application.remote_policy ?? "-")} />
            </div>
          </SectionBlock>

          <SectionBlock title="Criteria & Context" icon={SlidersHorizontal}>
            <div className="grid gap-8">
              <div className="grid gap-x-8 md:grid-cols-2">
                <MetricLine label="Seniority" value={String(applicationMeta.seniority ?? "-")} />
                <MetricLine label="Difficulty" value={String(applicationMeta.difficulty_level ?? "-")} />
              </div>
              <MetricLine label="Must-have" vertical value={Array.isArray(applicationMeta.must_have_skills) ? applicationMeta.must_have_skills.join(", ") || "-" : "-"} />
              <MetricLine label="Nice-to-have" vertical value={Array.isArray(applicationMeta.nice_to_have_skills) ? applicationMeta.nice_to_have_skills.join(", ") || "-" : "-"} />
              <div className="grid gap-x-8 md:grid-cols-2 pt-4 border-t border-border/70">
                <MetricLine label="Company" value={String(applicationMeta.company_context ?? "-")} />
                <MetricLine label="Team" value={String(applicationMeta.team_context ?? "-")} />
                <MetricLine label="Hiring goal" value={String(applicationMeta.hiring_goal ?? "-")} />
                <MetricLine label="Pain / challenge" value={String(applicationMeta.pain_challenge ?? "-")} />
              </div>
            </div>
          </SectionBlock>
        </div>

        <div className="space-y-8">
          <SectionBlock title="Evaluation settings">
            <div className="grid gap-1">
              <MetricLine label="LinkedIn required" value={booleanLabel(applicationMeta.use_linkedin_verification)} />
              <MetricLine label="Candidate links" value={booleanLabel(applicationMeta.candidate_link_enabled)} />
              <MetricLine label="Fit threshold" value={String(applicationMeta.fit_threshold ?? "80")} />
              <MetricLine label="Trust threshold" value={String(applicationMeta.trust_threshold ?? "75")} />
            </div>
          </SectionBlock>

          <MissionManagerForm
            applicationId={id}
            currentManagerId={pickString(data.manager?.id)}
            team={data.team as any[]}
          />
          
          <SectionBlock title="Danger zone" icon={Archive} className="border-rose-200 bg-rose-50/30">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-bold text-rose-900">Archive project</p>
                <p className="mt-1 text-xs text-rose-700/60 leading-relaxed">Keep candidates and analysis, but remove the project from active work.</p>
              </div>
              <ArchiveApplicationButton applicationId={id} />
            </div>
          </SectionBlock>
        </div>
      </div>
    </div>
  );
}
