import { notFound, redirect } from "next/navigation";
import { Archive, SlidersHorizontal } from "lucide-react";
import { ArchiveApplicationButton } from "@/components/hr/archive-application-button";
import { MetricLine, ApplicationTabs, PageHeader, SectionBlock, StatusBadge, applicationIcons } from "@/components/hr/application-components";
import { WorkSamplesUploadForm } from "@/components/hr/work-samples-upload-form";
import { getApplicationWorkspaceData, metadata, salaryLabel } from "@/lib/hr/application-workspace";
import { asObject, pickString, truncateText } from "@/lib/hr/utils";

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
        eyebrow="Application settings"
        title={String(data.application.title ?? "Application")}
        meta={<StatusBadge>{data.status}</StatusBadge>}
      />
      <ApplicationTabs applicationId={id} active="settings" />

      <div className="grid gap-8 xl:grid-cols-2">
        <SectionBlock title="Application info" icon={applicationIcons.settings}>
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

        <SectionBlock title="Company context">
          <MetricLine label="Company" value={String(applicationMeta.company_context ?? "-")} />
          <MetricLine label="Current situation" value={String(applicationMeta.current_situation ?? "-")} />
          <MetricLine label="Hiring goal" value={String(applicationMeta.hiring_goal ?? "-")} />
          <MetricLine label="Pain / challenge" value={String(applicationMeta.pain_challenge ?? "-")} />
        </SectionBlock>

        <SectionBlock title="Team context">
          <MetricLine label="Team" value={String(applicationMeta.team_context ?? "-")} />
          <MetricLine label="Team workflow" value={String(applicationMeta.team_workflow ?? "-")} />
          <MetricLine label="Previous work" value={String(applicationMeta.previous_team_work ?? "-")} />
          <MetricLine label="Work samples" value={workSamplesLabel(data.workSamples, applicationMeta.work_samples)} />
          <MetricLine label="Manager expectations" value={String(applicationMeta.manager_expectations ?? "-")} />
          <MetricLine label="Success criteria" value={String(applicationMeta.success_criteria ?? "-")} />
        </SectionBlock>

        <div className="xl:col-span-2">
          <SectionBlock title="Pipeline material" icon={applicationIcons.file}>
            <WorkSamplesUploadForm applicationId={id} samples={workSamples} />
          </SectionBlock>
        </div>

        <SectionBlock title="Pipeline settings">
          <MetricLine label="Contextual pipeline" value={booleanLabel(applicationMeta.generate_contextual_pipeline)} />
          <MetricLine label="Difficulty" value={String(applicationMeta.difficulty_level ?? "-")} />
          <MetricLine label="Number of questions" value={String(applicationMeta.number_of_questions ?? "-")} />
          <MetricLine label="Estimated time" value={applicationMeta.estimated_time_minutes ? `${String(applicationMeta.estimated_time_minutes)} min` : "-"} />
          <MetricLine label="Question types" value={listLabel(applicationMeta.question_types)} />
          <MetricLine label="Public apply enabled" value={booleanLabel(data.application.apply_enabled)} />
          <MetricLine label="Public apply link" value={publicApplyPath} />
          <MetricLine label="Generation mode" value={String(data.application.pipeline_generation_mode ?? applicationMeta.pipeline_generation_mode ?? "-")} />
          <MetricLine label="Candidate links" value={booleanLabel(applicationMeta.candidate_link_enabled)} />
        </SectionBlock>

        <SectionBlock title="Verification settings">
          <MetricLine label="Require CV upload" value={enabledByDefault(applicationMeta.require_cv_upload)} />
          <MetricLine label="Require LinkedIn URL" value={enabledByDefault(applicationMeta.require_linkedin_url)} />
          <MetricLine label="Use LinkedIn verification" value={booleanLabel(applicationMeta.use_linkedin_verification)} />
          <MetricLine label="CV / LinkedIn coherence" value={booleanLabel(applicationMeta.require_cv_coherence)} />
          <MetricLine label="Fit threshold" value={String(applicationMeta.fit_threshold ?? "80")} />
          <MetricLine label="Trust threshold" value={String(applicationMeta.trust_threshold ?? "75")} />
        </SectionBlock>

        <SectionBlock title="Danger zone" icon={Archive}>
          <div className="flex min-h-16 items-center justify-between gap-4 border-y border-border py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Archive application</p>
              <p className="mt-1 text-sm text-foreground/45">Keep candidates and analysis, but remove the application from active work.</p>
            </div>
            <ArchiveApplicationButton applicationId={id} />
          </div>
        </SectionBlock>
      </div>
    </div>
  );
}
