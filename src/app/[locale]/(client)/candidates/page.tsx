import Link from "next/link";
import { ArrowUpRight, Search, Users } from "lucide-react";
import { ActionLink, EmptyState, PageHeader, ScoreBadge, SectionBlock, StatusBadge } from "@/components/hr/application-components";
import { getCandidatesWorkspaceData } from "@/lib/hr/candidates-workspace";

export default async function CandidatesPage() {
  const { candidates, summary } = await getCandidatesWorkspaceData();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Talent database"
        title="Candidates"
        meta={
          <>
            <span>{summary.total} profiles</span>
            <span>{summary.analyzed} analyzed</span>
            <span>{summary.verified} LinkedIn verified</span>
            <span>Avg fit {summary.avgFit ?? "-"}</span>
          </>
        }
        actions={<ActionLink href="/hr/sourcing/import" icon={Users}>Import candidates</ActionLink>}
      />

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <SectionBlock title="Profiles">
          <p className="text-2xl font-semibold text-foreground">{summary.total}</p>
          <p className="mt-2 text-sm text-foreground/45">Total talent records</p>
        </SectionBlock>
        <SectionBlock title="Analyzed">
          <p className="text-2xl font-semibold text-foreground">{summary.analyzed}</p>
          <p className="mt-2 text-sm text-foreground/45">With fit or trust score</p>
        </SectionBlock>
        <SectionBlock title="Verified">
          <p className="text-2xl font-semibold text-foreground">{summary.verified}</p>
          <p className="mt-2 text-sm text-foreground/45">LinkedIn checked</p>
        </SectionBlock>
        <SectionBlock title="Strong matches">
          <p className="text-2xl font-semibold text-foreground">{summary.strongMatches}</p>
          <p className="mt-2 text-sm text-foreground/45">Ready for recruiter review</p>
        </SectionBlock>
      </div>

      {candidates.length ? (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[1120px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-[0.16em] text-foreground/40">
                <th className="px-3 py-3 font-medium">Candidate</th>
                <th className="px-3 py-3 font-medium">Current role</th>
                <th className="px-3 py-3 font-medium">Mission</th>
                <th className="px-3 py-3 font-medium">LinkedIn</th>
                <th className="px-3 py-3 font-medium">CV</th>
                <th className="px-3 py-3 text-right font-medium">Fit</th>
                <th className="px-3 py-3 text-right font-medium">Trust</th>
                <th className="px-3 py-3 font-medium">Recommendation</th>
                <th className="px-3 py-3 font-medium">Last activity</th>
                <th className="px-3 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {candidates.map((candidate) => (
                <tr key={candidate.id} className="transition hover:bg-secondary/35">
                  <td className="px-3 py-4">
                    <div className="font-medium text-foreground">{candidate.name}</div>
                    <div className="mt-1 text-xs text-foreground/45">{candidate.email}</div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-foreground/70">{candidate.currentRole}</div>
                    <div className="mt-1 text-xs text-foreground/40">{candidate.currentCompany}</div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="text-foreground/70">{candidate.missionTitle}</div>
                    <div className="mt-1 text-xs text-foreground/40">{candidate.missionCount} mission{candidate.missionCount === 1 ? "" : "s"}</div>
                  </td>
                  <td className="px-3 py-4"><StatusBadge>{candidate.linkedin}</StatusBadge></td>
                  <td className="px-3 py-4"><StatusBadge>{candidate.cv}</StatusBadge></td>
                  <td className="px-3 py-4 text-right"><ScoreBadge value={candidate.fitScore} /></td>
                  <td className="px-3 py-4 text-right"><ScoreBadge value={candidate.trustScore} /></td>
                  <td className="px-3 py-4"><StatusBadge>{candidate.recommendation}</StatusBadge></td>
                  <td className="px-3 py-4 text-foreground/55">{candidate.lastActivity}</td>
                  <td className="px-3 py-4 text-right">
                    <Link
                      href={`/candidates/${candidate.id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground"
                    >
                      Open
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No candidates yet" detail="Import candidates from a mission sourcing workspace to start building the talent database." />
      )}

      <div className="mt-8">
        <ActionLink href="/hr/sourcing/import" icon={Search} variant="secondary">Open import workspace</ActionLink>
      </div>
    </div>
  );
}
