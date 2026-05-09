import { notFound } from "next/navigation";
import { ApplicationTabs, PageHeader, ScoreBadge, SectionBlock, SourcingTabs, StatusBadge } from "@/components/hr/application-components";
import { getApplicationWorkspaceData } from "@/lib/hr/application-workspace";
import { pickString } from "@/lib/hr/utils";

export default async function SourcingCandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string; candidateId: string }>;
}) {
  const { id, candidateId } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const candidate = data.candidates.find((item) => item.id === candidateId);
  if (!candidate) notFound();
  const recommendationKey = String(candidate.recommendation ?? "").toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  const isRejected = ["do_not_contact", "low_fit", "weak_match", "reject", "rejected"].includes(recommendationKey);
  const riskSectionTitle = isRejected ? "Blocking factors" : "Risks to verify";

  return (
    <div className="mx-auto max-w-screen-2xl">
      <PageHeader
        eyebrow="Sourcing profile"
        title={candidate.name}
        meta={
          <>
            <span>{candidate.subtitle}</span>
            <StatusBadge>{candidate.recommendation}</StatusBadge>
            <ScoreBadge value={candidate.fitScore} />
            <ScoreBadge value={candidate.opportunityScore} />
          </>
        }
      />
      <ApplicationTabs applicationId={id} active="sourcing" workflowType="sourcing" />
      <SourcingTabs applicationId={id} active="candidates" />

      <div className="grid gap-8 lg:grid-cols-3">
        <SectionBlock title="Profile">
          <div className="space-y-3 text-sm text-foreground/65">
            <p><span className="text-foreground/40">Current role:</span> {candidate.currentRole}</p>
            <p><span className="text-foreground/40">Current company:</span> {candidate.currentCompany}</p>
            <p><span className="text-foreground/40">Location:</span> {candidate.location}</p>
            <p><span className="text-foreground/40">LinkedIn:</span> {pickString(candidate.candidate.linkedin_url) ?? "-"}</p>
          </div>
        </SectionBlock>

        <SectionBlock title="Scores">
          <div className="space-y-3 text-sm text-foreground/65">
            <p className="flex items-center justify-between"><span>Fit score</span><ScoreBadge value={candidate.fitScore} /></p>
            <p className="flex items-center justify-between"><span>Opportunity score</span><ScoreBadge value={candidate.opportunityScore} /></p>
            <p className="flex items-center justify-between"><span>LinkedIn</span><StatusBadge>{candidate.linkedin.label}</StatusBadge></p>
          </div>
        </SectionBlock>

        <SectionBlock title="Recommendation">
          <p className="text-sm leading-6 text-foreground/65">{candidate.whyThisProfile}</p>
          {!isRejected && candidate.whyNow ? (
            <p className="mt-3 text-sm leading-6 text-foreground/55">Why now: {candidate.whyNow}</p>
          ) : null}
        </SectionBlock>

        {!isRejected && candidate.suggestedAngle ? (
          <SectionBlock title="Suggested angle">
            <p className="text-sm leading-6 text-foreground/65">{candidate.suggestedAngle}</p>
          </SectionBlock>
        ) : null}

        <SectionBlock title="Signals">
          <ul className="space-y-2 text-sm leading-6 text-foreground/65">
            {(candidate.sourcingSignals.length ? candidate.sourcingSignals : ["Run sourcing analysis to generate signals."]).map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </SectionBlock>

        <SectionBlock title={riskSectionTitle}>
          <ul className="space-y-2 text-sm leading-6 text-foreground/65">
            {candidate.sourcingRisks.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </SectionBlock>
      </div>
    </div>
  );
}
