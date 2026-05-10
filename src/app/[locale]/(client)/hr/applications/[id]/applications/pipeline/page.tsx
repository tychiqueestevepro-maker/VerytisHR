import { notFound } from "next/navigation";
import { EmptyState, MetricLine, ApplicationTabs, PageHeader, ScoreBadge, SectionBlock, StatusBadge, applicationIcons } from "@/components/hr/application-components";
import { MissionPipelineActions, type PipelineCandidateOption, type PipelineSessionAction } from "@/components/hr/application-pipeline-actions";
import { getApplicationWorkspaceData, metadata } from "@/lib/hr/application-workspace";
import { asObject, pickString } from "@/lib/hr/utils";

function listLabel(value: unknown) {
  if (!Array.isArray(value)) return "-";
  const items = value.map((item) => String(item).replaceAll("_", " ")).filter(Boolean);
  return items.length ? items.join(", ") : "-";
}

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
  const candidateOptions: PipelineCandidateOption[] = data.candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
  }));
  const sessionActions: PipelineSessionAction[] = data.applicationSessions.map((session) => ({
    token: pickString(session.session.public_token),
    status: session.status,
  }));
  const publicSlug = pickString(data.application.public_slug);
  const publicApplyPath = data.application.apply_enabled === true && publicSlug
    ? `/jobs/${publicSlug}/apply`
    : null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Applications pipeline"
        title={String(data.application.title ?? "Mission")}
        meta={
          <>
            <StatusBadge>{data.pipeline ? "Pipeline generated" : "Pipeline missing"}</StatusBadge>
            <span>{data.questions.length} questions</span>
            {estimatedTime ? <span>{String(estimatedTime)} min</span> : null}
            <span>{difficulty}</span>
          </>
        }
      />
      <ApplicationTabs applicationId={id} active="pipeline" />

      <div className="space-y-8">
        <SectionBlock title="Pipeline status" icon={applicationIcons.pipeline}>
          <div className="grid gap-x-8 md:grid-cols-2 lg:grid-cols-3">
            <MetricLine label="Pipeline generated" value={data.pipeline ? "Yes" : "No"} />
            <MetricLine label="Questions" value={data.questions.length} />
            <MetricLine label="Target questions" value={String(requestedQuestions ?? "-")} />
            <MetricLine label="Estimated time" value={estimatedTime ? `${String(estimatedTime)} min` : "-"} />
            <MetricLine label="Question types" value={listLabel(questionTypes)} />
            <MetricLine label="Work samples" value={data.workSamples.length} />
            <MetricLine label="Difficulty" value={difficulty} />
            <MetricLine label="Sessions created" value={data.sessions.length} />
            <MetricLine label="Responses received" value={data.progress.responsesReceived} />
            <MetricLine label="Pipeline name" value={String(data.pipeline?.name ?? "-")} />
            <MetricLine label="Public apply link" value={publicApplyPath ?? "-"} />
          </div>
        </SectionBlock>

        <MissionPipelineActions
          applicationId={id}
          pipelineId={pickString(data.pipeline?.id)}
          publicApplyPath={publicApplyPath}
          candidates={candidateOptions}
          sessions={sessionActions}
        />

        <SectionBlock title="Generated questions / tests">
          {data.questions.length ? (
            <div className="overflow-x-auto border-y border-border">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-[0.16em] text-foreground/40">
                    <th className="px-3 py-3 font-medium">Question type</th>
                    <th className="px-3 py-3 font-medium">Question</th>
                    <th className="px-3 py-3 font-medium">Time</th>
                    <th className="px-3 py-3 font-medium">Points</th>
                    <th className="px-3 py-3 font-medium">Reasoning</th>
                    <th className="px-3 py-3 font-medium">Anti-cheat</th>
                    <th className="px-3 py-3 font-medium">Skill tested</th>
                    <th className="px-3 py-3 font-medium">Difficulty</th>
                    <th className="px-3 py-3 font-medium">Evaluation criteria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {data.questions.map((item) => (
                    <tr key={String(item.question.id)} className="transition hover:bg-secondary/35">
                      <td className="px-3 py-4"><StatusBadge>{item.typeLabel}</StatusBadge></td>
                      <td className="max-w-xl px-3 py-4 font-medium text-foreground">{pickString(item.question.label) ?? "Question"}</td>
                      <td className="px-3 py-4 text-foreground/65">{item.timeLimit}</td>
                      <td className="px-3 py-4 text-foreground/65">{item.points ?? "-"}</td>
                      <td className="px-3 py-4 text-foreground/65">{item.requiresReasoning ? "Yes" : "No"}</td>
                      <td className="px-3 py-4">
                        <span className="inline-flex rounded-md border border-border bg-secondary px-2 py-1 text-xs font-medium text-foreground/60">
                          {item.antiCheatLevel}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-foreground/65">{item.skillTested}</td>
                      <td className="px-3 py-4 text-foreground/65">{item.difficulty}</td>
                      <td className="max-w-xs px-3 py-4 text-foreground/55">{item.criteria}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No application pipeline yet" detail="Generate contextual questions from the mission, team and real work expectations." />
          )}
        </SectionBlock>

        <SectionBlock title="Candidate links">
          <div id="candidate-links" className="overflow-x-auto border-y border-border">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-[0.16em] text-foreground/40">
                  <th className="px-3 py-3 font-medium">Candidate</th>
                  <th className="px-3 py-3 font-medium">Link status</th>
                  <th className="px-3 py-3 font-medium">Response</th>
                  <th className="px-3 py-3 text-right font-medium">Score</th>
                  <th className="px-3 py-3 font-medium">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {data.applicationSessions.map((application) => {
                  const token = pickString(application.session.public_token);

                  return (
                    <tr key={application.id} className="transition hover:bg-secondary/35">
                      <td className="px-3 py-4">
                        <div className="font-medium text-foreground">{application.name}</div>
                        <div className="mt-1 text-xs text-foreground/45">{application.subtitle}</div>
                      </td>
                      <td className="px-3 py-4"><StatusBadge>{token ? "Created" : "Not created"}</StatusBadge></td>
                      <td className="px-3 py-4"><StatusBadge>{application.responseStatus}</StatusBadge></td>
                      <td className="px-3 py-4 text-right"><ScoreBadge value={application.pipelineScore} /></td>
                      <td className="px-3 py-4 text-foreground/55">
                        {token ? <code className="text-xs">/apply/{token}</code> : "-"}
                      </td>
                    </tr>
                  );
                })}
                {!data.applicationSessions.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center text-sm text-foreground/45">
                      Create candidate links to start receiving applications.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionBlock>
      </div>
    </div>
  );
}
