import { notFound } from "next/navigation";
import { EmptyState, MetricLine, ApplicationTabs, PageHeader, ScoreBadge, SectionBlock, StatusBadge, applicationIcons, DataTable, TagCloud } from "@/components/hr/application-components";
import { MissionPipelineActions } from "@/components/hr/application-pipeline-actions";
import { getApplicationWorkspaceData, metadata } from "@/lib/hr/application-workspace";
import { asObject, pickString, truncateText } from "@/lib/hr/utils";
import { cn } from "@/lib/utils";
import { Inbox, Link2 } from "lucide-react";
import { ApplicationStatusToggle } from "@/components/hr/application-status-toggle";

export default async function ApplicationsPipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const applicationMeta = metadata(data.application);
  const pipelineSettings = asObject(data.pipeline?.settings);
  const difficulty = pickString(pipelineSettings.difficulty, applicationMeta.difficulty_level) ?? "Medium";
  const requestedQuestions = pipelineSettings.requested_number_of_questions ?? applicationMeta.number_of_questions ?? data.questions.length;
  const estimatedTime = pipelineSettings.generated_estimated_total_time_minutes
    ?? pipelineSettings.requested_estimated_time_minutes
    ?? applicationMeta.estimated_time_minutes;
  const questionTypes = Array.isArray(pipelineSettings.requested_question_types)
    ? pipelineSettings.requested_question_types
    : applicationMeta.question_types;

  const publicSlug = pickString(data.application.public_slug);
  const publicApplyPath = data.application.apply_enabled === true && publicSlug
    ? `/jobs/${publicSlug}/apply`
    : null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Recruitment Cockpit"
        title={String(data.application.title ?? "Mission")}
        actions={
          <div className="flex items-center gap-3">
             <ApplicationStatusToggle applicationId={id} currentStatus={data.status} />
          </div>
        }
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <StatusBadge>{data.pipeline ? "Pipeline generated" : "Pipeline missing"}</StatusBadge>
            </span>
            <span className="flex items-center gap-1.5">
              <Inbox className="size-3.5 text-pink-500" />
              {data.questions.length} questions
            </span>
            {estimatedTime ? (
              <span className="flex items-center gap-1.5 font-medium">
                {String(estimatedTime)} min
              </span>
            ) : null}
            <span className="font-bold text-foreground/60 uppercase tracking-widest text-[10px]">{difficulty}</span>
          </>
        }
      />
      <ApplicationTabs applicationId={id} active="pipeline" />

      <div className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <SectionBlock title="Pipeline design" icon={applicationIcons.pipeline}>
            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <MetricLine label="Target questions" value={String(requestedQuestions ?? "-")} />
              <MetricLine label="Estimated time" value={estimatedTime ? `${String(estimatedTime)} min` : "-"} />
              <MetricLine label="Difficulty" value={difficulty} />
              <MetricLine label="Pipeline name" value={pickString(data.pipeline?.name) ? truncateText(String(data.pipeline!.name), 40) : "-"} />
              <MetricLine 
                label="Question types" 
                vertical
                className="sm:col-span-2"
                value={<TagCloud items={Array.isArray(questionTypes) ? questionTypes.map(q => String(q).replaceAll("_", " ")) : []} />} 
              />
            </div>
          </SectionBlock>

          <SectionBlock title="Status & Public link" icon={Link2}>
            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <MetricLine label="Pipeline generated" value={data.pipeline ? "Yes" : "No"} />
              <MetricLine label="Questions total" value={data.questions.length} />
              <MetricLine label="Work samples" value={data.workSamples.length} />
              <MetricLine label="Sessions created" value={data.sessions.length} />
              <MetricLine label="Responses received" value={data.progress.responsesReceived} />
              <MetricLine label="Public apply link" value={publicApplyPath ?? "-"} />
            </div>
          </SectionBlock>
        </div>

        <MissionPipelineActions
          applicationId={id}
          pipelineId={pickString(data.pipeline?.id)}
          publicApplyPath={publicApplyPath}
        />

        <SectionBlock title="Generated questions / tests">
          {data.questions.length ? (
            <DataTable 
              minWidth="1200px"
              headers={["Type", "Question", "Time", "Points", "Reasoning", "Anti-cheat", "Skill", "Difficulty", "Criteria"]}
            >
              {data.questions.map((item) => (
                <tr key={String(item.question.id)} className="group transition hover:bg-black/[0.02]">
                  <td className="px-4 py-4"><StatusBadge>{item.typeLabel}</StatusBadge></td>
                  <td className="max-w-xl px-4 py-4 font-bold text-foreground/80 group-hover:text-pink-600 transition-colors">
                    {pickString(item.question.label) ?? "Question"}
                  </td>
                  <td className="px-4 py-4 text-foreground/65 font-medium">{item.timeLimit}</td>
                  <td className="px-4 py-4 text-foreground/65 font-medium">{item.points ?? "-"}</td>
                  <td className="px-4 py-4 text-foreground/50 text-[11px] font-bold uppercase">{item.requiresReasoning ? "Yes" : "No"}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-lg border border-black/[0.05] bg-black/[0.02] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-foreground/40">
                      {item.antiCheatLevel}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-foreground/65 font-medium">{item.skillTested}</td>
                  <td className="px-4 py-4 text-foreground/65 font-medium">{item.difficulty}</td>
                  <td className="max-w-xs px-4 py-4">
                     <p className="line-clamp-2 text-[12px] leading-relaxed text-foreground/45 group-hover:line-clamp-none transition-all">
                      {item.criteria}
                     </p>
                  </td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <EmptyState title="No application pipeline yet" detail="Generate contextual questions from the mission, team and real work expectations." />
          )}
        </SectionBlock>
      </div>
    </div>
  );
}
