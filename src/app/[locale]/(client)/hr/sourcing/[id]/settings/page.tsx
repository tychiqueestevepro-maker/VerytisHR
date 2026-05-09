import { notFound } from "next/navigation";
import { Archive, SlidersHorizontal } from "lucide-react";
import { ArchiveApplicationButton } from "@/components/hr/archive-application-button";
import { MetricLine, SourcingTabs, PageHeader, SectionBlock, StatusBadge, applicationIcons } from "@/components/hr/application-components";
import { SourcingHeaderActions } from "@/components/hr/sourcing-header-actions";
import { getApplicationWorkspaceData, metadata, salaryLabel } from "@/lib/hr/application-workspace";

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
        actions={<SourcingHeaderActions applicationId={id} />}
        meta={<StatusBadge>{data.status}</StatusBadge>}
      />
      <SourcingTabs applicationId={id} active="settings" />

      <div className="grid gap-8 xl:grid-cols-2">
        <SectionBlock title="Project info" icon={applicationIcons.settings}>
          <MetricLine label="Title" value={String(data.application.title ?? "-")} />
          <MetricLine label="Location" value={String(data.application.location ?? "-")} />
          <MetricLine label="Salary" value={salaryLabel(data.application)} />
          <MetricLine label="Work mode" value={String(data.application.remote_policy ?? "-")} />
        </SectionBlock>

        <SectionBlock title="Criteria" icon={SlidersHorizontal}>
          <MetricLine label="Must-have" value={Array.isArray(applicationMeta.must_have_skills) ? applicationMeta.must_have_skills.join(", ") || "-" : "-"} />
          <MetricLine label="Nice-to-have" value={Array.isArray(applicationMeta.nice_to_have_skills) ? applicationMeta.nice_to_have_skills.join(", ") || "-" : "-"} />
          <MetricLine label="Seniority" value={String(applicationMeta.seniority ?? "-")} />
          <MetricLine label="Difficulty" value={String(applicationMeta.difficulty_level ?? "-")} />
        </SectionBlock>

        <SectionBlock title="Context">
          <MetricLine label="Company" value={String(applicationMeta.company_context ?? "-")} />
          <MetricLine label="Team" value={String(applicationMeta.team_context ?? "-")} />
          <MetricLine label="Hiring goal" value={String(applicationMeta.hiring_goal ?? "-")} />
          <MetricLine label="Pain / challenge" value={String(applicationMeta.pain_challenge ?? "-")} />
        </SectionBlock>

        <SectionBlock title="Evaluation">
          <MetricLine label="LinkedIn required" value={booleanLabel(applicationMeta.use_linkedin_verification)} />
          <MetricLine label="Candidate links" value={booleanLabel(applicationMeta.candidate_link_enabled)} />
          <MetricLine label="Fit threshold" value={String(applicationMeta.fit_threshold ?? "80")} />
          <MetricLine label="Trust threshold" value={String(applicationMeta.trust_threshold ?? "75")} />
        </SectionBlock>

        <SectionBlock title="Danger zone" icon={Archive}>
          <div className="flex min-h-16 items-center justify-between gap-4 border-y border-border py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Archive sourcing project</p>
              <p className="mt-1 text-sm text-foreground/45">Keep candidates and analysis, but remove the project from active work.</p>
            </div>
            <ArchiveApplicationButton applicationId={id} />
          </div>
        </SectionBlock>
      </div>
    </div>
  );
}
