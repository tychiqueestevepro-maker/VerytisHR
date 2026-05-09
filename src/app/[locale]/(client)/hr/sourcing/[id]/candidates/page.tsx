import { notFound } from "next/navigation";
import { ApplicationCandidatesTable, type CandidateTableRow } from "@/components/hr/application-candidates-table";
import { PageHeader, SourcingTabs } from "@/components/hr/application-components";
import { SourcingHeaderActions } from "@/components/hr/sourcing-header-actions";
import { getApplicationWorkspaceData } from "@/lib/hr/application-workspace";

export default async function SourcingCandidatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const candidates: CandidateTableRow[] = (data.candidates as any[] || []).map((item) => ({
    id: item.id,
    name: item.name,
    profileImageUrl: item.profileImageUrl,
    subtitle: item.subtitle,
    currentRole: item.currentRole,
    currentCompany: item.currentCompany,
    linkedin: item.linkedin.label,
    linkedinUrl: typeof item.candidate.linkedin_url === "string" ? item.candidate.linkedin_url : null,
    fitScore: item.fitScore,
    opportunityScore: item.opportunityScore,
    signals: item.sourcingSignals,
    status: item.status,
    recommendation: item.recommendation,
  }));

  return (
    <div className="mx-auto max-w-screen-2xl">
      <PageHeader
        eyebrow="Sourcing talent pool"
        title={String(data.application.title ?? "Mission")}
        actions={<SourcingHeaderActions applicationId={id} />}
        meta={
          <>
            <span>{data.progress.candidatesImported} profiles</span>
            <span>{data.progress.linkedinVerified} LinkedIn verified</span>
            <span>{data.progress.analyzed} analyzed</span>
          </>
        }
      />
      <SourcingTabs applicationId={id} active="candidates" />
      <ApplicationCandidatesTable applicationId={id} candidates={candidates} />
    </div>
  );
}
