import { notFound } from "next/navigation";
import { ApplicationsTabs, EmptyState, ApplicationTabs, PageHeader, ScoreBadge, StatusBadge } from "@/components/hr/application-components";
import { getApplicationWorkspaceData } from "@/lib/hr/application-workspace";

export default async function ApplicationsResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const results = [...data.applicationSessions]
    .filter((application) => application.status === "submitted" || application.status === "analyzed" || application.pipelineScore !== null)
    .sort((a, b) => (b.pipelineScore ?? -1) - (a.pipelineScore ?? -1));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Application results"
        title={`Who fits the real work for ${String(data.application.title ?? "Mission")}`}
        meta={
          <>
            <span>{results.length} applications reviewed</span>
            <span>{data.progress.responsesReceived} responses received</span>
          </>
        }
      />
      <ApplicationTabs applicationId={id} active="applications" />
      <ApplicationsTabs applicationId={id} active="results" />

      {results.length ? (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-[0.16em] text-foreground/40">
                <th className="px-3 py-3 font-medium">Candidate</th>
                <th className="px-3 py-3 font-medium">CV status</th>
                <th className="px-3 py-3 font-medium">LinkedIn coherence</th>
                <th className="px-3 py-3 text-right font-medium">Pipeline score</th>
                <th className="px-3 py-3 text-right font-medium">Fit score</th>
                <th className="px-3 py-3 text-right font-medium">Trust score</th>
                <th className="px-3 py-3 text-right font-medium">Team fit</th>
                <th className="px-3 py-3 font-medium">Strengths</th>
                <th className="px-3 py-3 font-medium">Risks</th>
                <th className="px-3 py-3 font-medium">Recommendation</th>
                <th className="px-3 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {results.map((application) => (
                <tr key={application.id} className="transition hover:bg-secondary/35">
                  <td className="px-3 py-4">
                    <div className="font-medium text-foreground">{application.name}</div>
                    <div className="mt-1 text-xs text-foreground/45">{application.subtitle}</div>
                  </td>
                  <td className="px-3 py-4"><StatusBadge>{application.cvStatus}</StatusBadge></td>
                  <td className="px-3 py-4"><StatusBadge>{application.linkedinCvCoherence}</StatusBadge></td>
                  <td className="px-3 py-4 text-right"><ScoreBadge value={application.pipelineScore} /></td>
                  <td className="px-3 py-4 text-right"><ScoreBadge value={application.fitScore} /></td>
                  <td className="px-3 py-4 text-right"><ScoreBadge value={application.trustScore} /></td>
                  <td className="px-3 py-4 text-right"><ScoreBadge value={application.teamFitScore} /></td>
                  <td className="max-w-xs px-3 py-4 text-foreground/70">{application.strengths[0] ?? "-"}</td>
                  <td className="max-w-xs px-3 py-4 text-foreground/55">{application.risks[0] ?? "-"}</td>
                  <td className="px-3 py-4"><StatusBadge>{application.recommendation}</StatusBadge></td>
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
        <EmptyState title="No application results yet" detail="Share a candidate link, receive responses and analyze them to rank inbound applications." />
      )}
    </div>
  );
}
