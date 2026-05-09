import { notFound } from "next/navigation";
import { ApplicationsTabs, EmptyState, ApplicationTabs, PageHeader, ScoreBadge, StatusBadge } from "@/components/hr/application-components";
import { getApplicationWorkspaceData, relativeTime } from "@/lib/hr/application-workspace";
import { pickString } from "@/lib/hr/utils";

export default async function ApplicationsSessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Application sessions"
        title={String(data.application.title ?? "Mission")}
        meta={
          <>
            <span>{data.applicationSessions.length} sessions</span>
            <span>{data.progress.responsesReceived} submitted</span>
          </>
        }
      />
      <ApplicationTabs applicationId={id} active="applications" />
      <ApplicationsTabs applicationId={id} active="sessions" />

      {data.applicationSessions.length ? (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-[0.16em] text-foreground/40">
                <th className="px-3 py-3 font-medium">Candidate</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 text-right font-medium">Completion</th>
                <th className="px-3 py-3 text-right font-medium">Pipeline score</th>
                <th className="px-3 py-3 font-medium">Created</th>
                <th className="px-3 py-3 font-medium">Submitted</th>
                <th className="px-3 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {data.applicationSessions.map((application) => (
                <tr key={application.id} className="transition hover:bg-secondary/35">
                  <td className="px-3 py-4">
                    <div className="font-medium text-foreground">{application.name}</div>
                    <div className="mt-1 text-xs text-foreground/45">{application.subtitle}</div>
                  </td>
                  <td className="px-3 py-4"><StatusBadge>{application.responseStatus}</StatusBadge></td>
                  <td className="px-3 py-4 text-right font-medium">{application.completion}%</td>
                  <td className="px-3 py-4 text-right"><ScoreBadge value={application.pipelineScore} /></td>
                  <td className="px-3 py-4 text-foreground/55">{relativeTime(application.session.created_at)}</td>
                  <td className="px-3 py-4 text-foreground/55">{pickString(application.session.submitted_at) ? relativeTime(application.session.submitted_at) : "-"}</td>
                  <td className="px-3 py-4 text-right">
                    <a
                      href={`/hr/applications/${id}/applications/${application.id}`}
                      className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground"
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No application sessions yet" detail="Generate a pipeline and create candidate links to start receiving applications." />
      )}
    </div>
  );
}
