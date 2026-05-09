import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ExternalLink, FileText, Link2 } from "lucide-react";
import { ActionLink, EmptyState, MetricLine, PageHeader, ScoreBadge, SectionBlock, StatusBadge } from "@/components/hr/application-components";
import { getCandidateDetailData } from "@/lib/hr/candidates-workspace";
import { pickString } from "@/lib/hr/utils";

function fileSizeLabel(size: number | null) {
  if (size === null) return "-";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${Math.round((size / (1024 * 1024)) * 10) / 10} MB`;
}

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCandidateDetailData(id);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Candidate profile"
        title={data.name}
        meta={
          <>
            <span>{data.subtitle}</span>
            <StatusBadge>{data.status}</StatusBadge>
            <StatusBadge>{data.recommendation}</StatusBadge>
          </>
        }
        actions={<ActionLink href="/candidates" icon={ArrowLeft} variant="secondary">Back</ActionLink>}
      />

      <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionBlock title="Profile">
          <MetricLine label="Email" value={pickString(data.candidate.email) ?? "-"} />
          <MetricLine label="Phone" value={pickString(data.candidate.phone) ?? "-"} />
          <MetricLine label="Location" value={pickString(data.candidate.location) ?? "-"} />
          <MetricLine label="Current title" value={pickString(data.candidate.current_title) ?? "-"} />
          <MetricLine label="Current company" value={pickString(data.candidate.current_company_name) ?? "-"} />
          <MetricLine
            label="LinkedIn"
            value={
              pickString(data.candidate.linkedin_url) ? (
                <a
                  href={pickString(data.candidate.linkedin_url) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                >
                  Open
                  <ExternalLink className="size-3" />
                </a>
              ) : "-"
            }
          />
        </SectionBlock>

        <SectionBlock title="Evaluation">
          <div className="grid gap-x-8 md:grid-cols-2">
            <MetricLine label="Fit score" value={<ScoreBadge value={data.fitScore} />} />
            <MetricLine label="Trust score" value={<ScoreBadge value={data.trustScore} />} />
            <MetricLine label="CV status" value={<StatusBadge>{data.cv}</StatusBadge>} />
            <MetricLine label="LinkedIn status" value={<StatusBadge>{data.linkedin}</StatusBadge>} />
            <MetricLine label="Missions" value={String(data.applications.length)} />
            <MetricLine label="Application sessions" value={String(data.sessions.length)} />
          </div>
        </SectionBlock>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <SectionBlock title="Mission history">
          {data.applications.length ? (
            <div className="overflow-x-auto border-y border-border">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-[0.16em] text-foreground/40">
                    <th className="px-3 py-3 font-medium">Mission</th>
                    <th className="px-3 py-3 text-right font-medium">Fit</th>
                    <th className="px-3 py-3 text-right font-medium">Trust</th>
                    <th className="px-3 py-3 font-medium">Recommendation</th>
                    <th className="px-3 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {data.applications.map((mission) => (
                    <tr key={mission.id} className="transition hover:bg-secondary/35">
                      <td className="px-3 py-4">
                        <div className="font-medium text-foreground">{mission.title}</div>
                        <div className="mt-1 text-xs text-foreground/45">{mission.team} - {mission.updatedAt}</div>
                      </td>
                      <td className="px-3 py-4 text-right"><ScoreBadge value={mission.fitScore} /></td>
                      <td className="px-3 py-4 text-right"><ScoreBadge value={mission.trustScore} /></td>
                      <td className="px-3 py-4"><StatusBadge>{mission.recommendation}</StatusBadge></td>
                      <td className="px-3 py-4 text-right">
                        <Link
                          href={`/hr/sourcing/${mission.applicationId}/${id}`}
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
            <EmptyState title="No mission attached" detail="Attach this profile to a mission before running a contextual fit analysis." />
          )}
        </SectionBlock>

        <SectionBlock title="Documents" icon={FileText}>
          {data.documents.length ? (
            <div className="divide-y divide-border/70 border-y border-border">
              {data.documents.map((document) => (
                <div key={document.id} className="grid gap-3 py-4 text-sm md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium text-foreground">{document.name}</p>
                    <p className="mt-1 text-xs text-foreground/45">{document.type} - {fileSizeLabel(document.size)} - {document.updatedAt}</p>
                  </div>
                  <StatusBadge>{document.status}</StatusBadge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No document" detail="No resume or file has been attached to this candidate." />
          )}
        </SectionBlock>

        <SectionBlock title="LinkedIn checks" icon={Link2}>
          {data.verifications.length ? (
            <div className="divide-y divide-border/70 border-y border-border">
              {data.verifications.map((verification) => (
                <div key={verification.id} className="grid gap-3 py-4 text-sm md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium text-foreground">{verification.profileName}</p>
                    <p className="mt-1 text-xs text-foreground/45">{verification.headline} - {verification.company} - {verification.checkedAt}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScoreBadge value={verification.confidence} />
                    <StatusBadge>{verification.status}</StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No LinkedIn check" detail="LinkedIn verification has not run for this candidate yet." />
          )}
        </SectionBlock>

        <SectionBlock title="Signals">
          {data.signals.length ? (
            <div className="divide-y divide-border/70 border-y border-border">
              {data.signals.slice(0, 8).map((signal) => (
                <div key={signal.id} className="py-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-foreground">{signal.label}</p>
                    <StatusBadge>{signal.type}</StatusBadge>
                  </div>
                  <p className="mt-2 leading-6 text-foreground/55">{signal.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No signals" detail="Signals will appear after a fit analysis." />
          )}
        </SectionBlock>

        <SectionBlock title="Inconsistencies">
          {data.inconsistencies.length ? (
            <div className="divide-y divide-border/70 border-y border-border">
              {data.inconsistencies.map((item) => (
                <div key={item.id} className="py-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-foreground">{item.field}</p>
                    <div className="flex items-center gap-2">
                      <StatusBadge>{item.severity}</StatusBadge>
                      <StatusBadge>{item.status}</StatusBadge>
                    </div>
                  </div>
                  <p className="mt-2 leading-6 text-foreground/55">{item.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No inconsistencies" detail="No CV or LinkedIn inconsistencies are currently open." />
          )}
        </SectionBlock>
      </div>
    </div>
  );
}
