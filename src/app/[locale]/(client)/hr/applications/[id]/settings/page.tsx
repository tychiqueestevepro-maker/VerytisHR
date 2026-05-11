import { notFound, redirect } from "next/navigation";
import { Archive, SlidersHorizontal, Inbox, Link2 } from "lucide-react";
import { ArchiveApplicationButton } from "@/components/hr/archive-application-button";
import { ActionLink, MetricLine, ApplicationTabs, PageHeader, SectionBlock, StatusBadge, applicationIcons } from "@/components/hr/application-components";
import { MissionManagerForm } from "@/components/hr/mission-manager-form";
import { ApplicationStatusToggle } from "@/components/hr/application-status-toggle";
import { WorkSamplesUploadForm } from "@/components/hr/work-samples-upload-form";
import { getApplicationWorkspaceData, metadata, salaryLabel } from "@/lib/hr/application-workspace";
import { asObject, pickString, truncateText } from "@/lib/hr/utils";
import { cn } from "@/lib/utils";

function booleanLabel(value: unknown) {
  return value === true ? "Yes" : "No";
}

function enabledByDefault(value: unknown) {
  return value !== false ? "Yes" : "No";
}

function listLabel(value: unknown) {
  if (!Array.isArray(value)) return "-";
  const items = value
    .map((item) => String(item).replaceAll("_", " "))
    .filter(Boolean);
  return items.length ? items.join(", ") : "-";
}

function workSamplesLabel(samples: Record<string, unknown>[], fallback: unknown) {
  if (samples.length) {
    return samples
      .map((sample) => [pickString(sample.file_name) ?? "Work sample", pickString(sample.status)].filter(Boolean).join(" - "))
      .join(", ");
  }

  return String(fallback ?? "-");
}

export default async function ApplicationSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const applicationMeta = metadata(data.application);
  const publicSlug = pickString(data.application.public_slug);
  const publicApplyPath = data.application.apply_enabled === true && publicSlug ? `/jobs/${publicSlug}/apply` : "-";
  const workSamples = data.workSamples.map((sample) => {
    const sampleMetadata = asObject(sample.metadata);
    const extractedText = pickString(sample.extracted_text);

    return {
      id: pickString(sample.id),
      fileName: pickString(sample.file_name),
      sampleType: pickString(sample.sample_type),
      mimeType: pickString(sample.mime_type),
      fileSizeBytes: sample.file_size_bytes,
      status: pickString(sample.status),
      parseError: pickString(sampleMetadata.parse_error),
      extractedText: extractedText ? truncateText(extractedText, 12000) : null,
      createdAt: pickString(sample.created_at),
    };
  });

  if (applicationMeta.workflow_type === "sourcing") {
    redirect(`/hr/sourcing/${id}/settings`);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Recruitment Cockpit"
        title={String(data.application.title ?? "Application")}
        actions={
          <div className="flex items-center gap-3">
             <ApplicationStatusToggle applicationId={id} currentStatus={data.status} />
             <ActionLink href={`/hr/applications/${id}/edit`} icon={SlidersHorizontal} variant="pink">Modify</ActionLink>
          </div>
        }
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <Inbox className="size-3.5 text-pink-500" />
              {data.sessions.length} sessions
            </span>
            <span className="flex items-center gap-1.5">
              <Link2 className="size-3.5 text-foreground/40" />
              {publicSlug ? `/jobs/${publicSlug}` : "No public link"}
            </span>
          </>
        }
      />
      <ApplicationTabs applicationId={id} active="settings" />

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          <SectionBlock title="Application info" icon={applicationIcons.settings}>
            <div className="grid gap-x-8 md:grid-cols-2">
              <MetricLine label="Title" value={String(data.application.title ?? "-")} />
              <MetricLine label="Location" value={String(data.application.location ?? "-")} />
              <MetricLine label="Salary" value={salaryLabel(data.application)} />
              <MetricLine label="Work mode" value={String(data.application.remote_policy ?? "-")} />
            </div>
          </SectionBlock>

          <SectionBlock title="Criteria" icon={SlidersHorizontal}>
            <div className="grid gap-8">
              <div>
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Must-have skills</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(applicationMeta.must_have_skills) ? applicationMeta.must_have_skills : []).map((skill: string) => (
                    <span key={skill} className="rounded-lg border border-pink-500/10 bg-pink-500/5 px-2.5 py-1.5 text-[11px] font-bold text-pink-700 shadow-sm transition-all hover:bg-pink-500/10">
                      {skill}
                    </span>
                  ))}
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
                </div>
              </div>

              <div className="grid gap-x-8 md:grid-cols-2 pt-4 border-t border-black/[0.03]">
                <MetricLine label="Seniority" value={String(applicationMeta.seniority ?? "-")} />
                <MetricLine label="Difficulty" value={String(applicationMeta.difficulty_level ?? "-")} />
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="Team & Context">
            <div className="grid gap-x-8 md:grid-cols-2">
              <MetricLine label="Company" value={String(applicationMeta.company_context ?? "-")} />
              <MetricLine label="Current situation" value={String(applicationMeta.current_situation ?? "-")} />
              <MetricLine label="Hiring goal" value={String(applicationMeta.hiring_goal ?? "-")} />
              <MetricLine label="Pain / challenge" value={String(applicationMeta.pain_challenge ?? "-")} />
              <MetricLine label="Team" value={String(applicationMeta.team_context ?? "-")} />
              <MetricLine label="Team workflow" value={String(applicationMeta.team_workflow ?? "-")} />
              <MetricLine label="Previous work" value={String(applicationMeta.previous_team_work ?? "-")} />
              <MetricLine label="Work samples" value={workSamplesLabel(data.workSamples, applicationMeta.work_samples)} />
              <MetricLine label="Manager expectations" value={String(applicationMeta.manager_expectations ?? "-")} />
              <MetricLine label="Success criteria" value={String(applicationMeta.success_criteria ?? "-")} />
            </div>
          </SectionBlock>

          <SectionBlock title="Pipeline material" icon={applicationIcons.file}>
            <WorkSamplesUploadForm applicationId={id} samples={workSamples} />
          </SectionBlock>
        </div>

        <div className="space-y-8">
          <SectionBlock title="Pipeline settings">
            <div className="grid gap-1">
              <MetricLine label="Contextual pipeline" value={booleanLabel(applicationMeta.generate_contextual_pipeline)} />
              <MetricLine label="Difficulty" value={String(applicationMeta.difficulty_level ?? "-")} />
              <MetricLine label="Questions" value={String(applicationMeta.number_of_questions ?? "-")} />
              <MetricLine label="Estimated time" value={applicationMeta.estimated_time_minutes ? `${String(applicationMeta.estimated_time_minutes)} min` : "-"} />
              <MetricLine label="Question types" value={listLabel(applicationMeta.question_types)} />
              <MetricLine label="Public apply" value={booleanLabel(data.application.apply_enabled)} />
              <MetricLine label="Public link" value={publicApplyPath} />
              <MetricLine label="Generation mode" value={String(data.application.pipeline_generation_mode ?? applicationMeta.pipeline_generation_mode ?? "-")} />
              <MetricLine label="Candidate links" value={booleanLabel(applicationMeta.candidate_link_enabled)} />
            </div>
          </SectionBlock>

          <SectionBlock title="Verification settings">
            <div className="grid gap-1">
              <MetricLine label="Require CV" value={enabledByDefault(applicationMeta.require_cv_upload)} />
              <MetricLine label="Require LinkedIn" value={enabledByDefault(applicationMeta.require_linkedin_url)} />
              <MetricLine label="LinkedIn verify" value={booleanLabel(applicationMeta.use_linkedin_verification)} />
              <MetricLine label="CV / LinkedIn" value={booleanLabel(applicationMeta.require_cv_coherence)} />
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
            <div className="flex min-h-16 items-center justify-between gap-4 py-2">
              <div>
                <p className="text-sm font-bold text-rose-900">Archive application</p>
                <p className="mt-1 text-xs text-rose-700/60 leading-relaxed">Keep candidates and analysis, but remove the application from active work.</p>
              </div>
              <ArchiveApplicationButton applicationId={id} />
            </div>
          </SectionBlock>
        </div>
      </div>
    </div>
  );
}
