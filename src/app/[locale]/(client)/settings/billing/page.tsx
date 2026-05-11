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

      <div className="grid gap-8 xl:grid-cols-1">
        <SectionBlock title="Credit ledger" icon={ReceiptText}>
          {usage.credits.length ? (
            <div className="overflow-x-auto rounded-2xl border border-white/40 bg-white/20 backdrop-blur-md shadow-sm">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-black/[0.03] text-left text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/30 bg-black/[0.01]">
                    <th className="px-6 py-4 font-bold">Transaction</th>
                    <th className="px-6 py-4 font-bold">Description</th>
                    <th className="px-6 py-4 font-bold text-right">Amount</th>
                    <th className="px-6 py-4 font-bold text-right">Balance</th>
                    <th className="px-6 py-4 font-bold text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.03]">
                  {usage.credits.map((credit) => (
                    <tr key={credit.id} className="transition hover:bg-black/[0.02]">
                      <td className="px-6 py-4 font-bold text-foreground capitalize">{credit.type}</td>
                      <td className="px-6 py-4 text-foreground/50 font-medium">{credit.description}</td>
                      <td className={cn("px-6 py-4 text-right font-bold", credit.amount > 0 ? "text-emerald-600" : "text-foreground")}>
                        {credit.amount > 0 ? "+" : ""}{credit.amount}
                      </td>
                      <td className="px-6 py-4 text-right text-foreground/60 font-bold">{credit.balanceAfter}</td>
                      <td className="px-6 py-4 text-right text-foreground/40 font-medium">{credit.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No credit transactions" detail="Credit purchases, grants and adjustments will be listed here." />
          )}
        </SectionBlock>
      </div>
    </div>
  );
}
