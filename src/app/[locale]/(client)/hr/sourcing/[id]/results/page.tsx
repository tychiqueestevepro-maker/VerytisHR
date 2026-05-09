import { notFound } from "next/navigation";
import { EmptyState, PageHeader, SourcingTabs } from "@/components/hr/application-components";
import { SourcingHeaderActions } from "@/components/hr/sourcing-header-actions";
import { SourcingResultsTable } from "@/components/hr/sourcing-results-table";
import { getApplicationWorkspaceData } from "@/lib/hr/application-workspace";

export default async function SourcingResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const results = [...data.candidates]
    .filter((candidate) => candidate.fitScore !== null || candidate.opportunityScore !== null)
    .sort((a, b) => (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1) || (b.fitScore ?? -1) - (a.fitScore ?? -1));

  return (
    <div className="mx-auto max-w-screen-2xl">
      <PageHeader
        eyebrow="Sourcing results"
        title={`Who to contact first for ${String(data.application.title ?? "Mission")}`}
        actions={<SourcingHeaderActions applicationId={id} />}
        meta={
          <>
            <span>{data.summary.analyzedCount} profiles analyzed</span>
            <span>{data.summary.strongMatches} strong matches</span>
            <span>{data.summary.reviewNeeded} review needed</span>
          </>
        }
      />
      <SourcingTabs applicationId={id} active="results" />

      {results.length ? (
        <SourcingResultsTable candidates={results} />
      ) : (
        <EmptyState title="No sourcing results yet" detail="Import profiles, verify LinkedIn and run sourcing analysis to rank who to contact first." />
      )}
    </div>
  );
}
