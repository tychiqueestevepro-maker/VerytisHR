import { CreditCard, Gauge, ReceiptText } from "lucide-react";
import { EmptyState, MetricLine, PageHeader, SectionBlock, StatusBadge } from "@/components/hr/application-components";
import { getSettingsWorkspaceData } from "@/lib/hr/settings-workspace";

function LimitLine({ label, used, limit }: { label: string; used?: number; limit: number }) {
  const width = typeof used === "number" && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="border-b border-border/70 py-3 last:border-0">
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="text-foreground/45">{label}</span>
        <span className="font-medium text-foreground">{typeof used === "number" ? `${used} / ${limit}` : limit}</span>
      </div>
      {typeof used === "number" ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-foreground" style={{ width: `${width}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export default async function BillingSettingsPage() {
  const { company, usage, workspace } = await getSettingsWorkspaceData();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Settings"
        title="Billing & credits"
        meta={
          <>
            <StatusBadge>{company.plan}</StatusBadge>
            <span>{company.creditsBalance} credits available</span>
            <span>{usage.totalCreditsSpent} credits logged</span>
          </>
        }
      />

      <div className="mb-8 grid gap-8 xl:grid-cols-3">
        <SectionBlock title="Plan" icon={CreditCard}>
          <MetricLine label="Current plan" value={<StatusBadge>{company.plan}</StatusBadge>} />
          <MetricLine label="Company status" value={<StatusBadge>{company.status}</StatusBadge>} />
          <MetricLine label="Billing email" value={company.billingEmail} />
          <MetricLine label="Credit balance" value={String(company.creditsBalance)} />
        </SectionBlock>

        <SectionBlock title="Workspace usage" icon={Gauge}>
          <LimitLine label="Missions" used={workspace.applications} limit={usage.limits.maxMissions} />
          <LimitLine label="Candidates" used={workspace.candidates} limit={usage.limits.maxCandidates} />
          <LimitLine label="Pipeline generations" limit={usage.limits.maxPipelineGenerations} />
          <LimitLine label="Pipeline sessions" limit={usage.limits.maxPipelineSessions} />
        </SectionBlock>

        <SectionBlock title="Automation limits">
          <LimitLine label="LinkedIn verifications" limit={usage.limits.maxLinkedinVerifications} />
          <LimitLine label="Document parses" limit={usage.limits.maxDocumentParses} />
          <LimitLine label="Response analyses" limit={usage.limits.maxPipelineResponseAnalyses} />
          <LimitLine label="Pipeline responses" limit={usage.limits.maxPipelineResponses} />
        </SectionBlock>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <SectionBlock title="Recent usage" icon={ReceiptText}>
          {usage.recent.length ? (
            <div className="divide-y divide-border/70 border-y border-border">
              {usage.recent.map((item) => (
                <div key={item.id} className="grid gap-3 py-4 text-sm md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium capitalize text-foreground">{item.event}</p>
                    <p className="mt-1 text-xs text-foreground/45">{item.provider} - {item.model} - {item.createdAt}</p>
                  </div>
                  <span className="font-medium text-foreground">{item.credits}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No usage yet" detail="Credit usage will appear after AI scoring, parsing or verification events." />
          )}
        </SectionBlock>

        <SectionBlock title="Credit ledger">
          {usage.credits.length ? (
            <div className="divide-y divide-border/70 border-y border-border">
              {usage.credits.map((credit) => (
                <div key={credit.id} className="grid gap-3 py-4 text-sm md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium capitalize text-foreground">{credit.type}</p>
                    <p className="mt-1 text-xs text-foreground/45">{credit.description} - {credit.createdAt}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{credit.amount > 0 ? "+" : ""}{credit.amount}</p>
                    <p className="mt-1 text-xs text-foreground/45">Balance {credit.balanceAfter}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No credit transactions" detail="Credit purchases, grants and adjustments will be listed here." />
          )}
        </SectionBlock>
      </div>
    </div>
  );
}
