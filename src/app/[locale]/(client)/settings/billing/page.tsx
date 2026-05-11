import { Coins, CreditCard, Gauge, ReceiptText } from "lucide-react";
import { EmptyState, MetricLine, PageHeader, SectionBlock, StatusBadge } from "@/components/hr/application-components";
import { getSettingsWorkspaceData } from "@/lib/hr/settings-workspace";
import { cn } from "@/lib/utils/index";

function LimitLine({ label, used, limit }: { label: string; used?: number; limit: number }) {
  const width = typeof used === "number" && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isNearLimit = typeof used === "number" && limit > 0 && used / limit >= 0.85;
  const isOverLimit = typeof used === "number" && limit > 0 && used >= limit;

  return (
    <div className="border-b border-border/70 py-3 last:border-0">
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="text-foreground/45">{label}</span>
        <span className={cn(
          "font-medium",
          isOverLimit ? "text-red-500" : isNearLimit ? "text-amber-500" : "text-foreground"
        )}>
          {typeof used === "number" ? `${used} / ${limit}` : limit}
        </span>
      </div>
      {typeof used === "number" ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isOverLimit ? "bg-red-500" : isNearLimit ? "bg-amber-400" : "bg-gradient-to-r from-pink-500 to-fuchsia-500"
            )}
            style={{ width: `${width}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default async function BillingSettingsPage() {
  const { company, usage, workspace, team } = await getSettingsWorkspaceData();
  const limits = usage.limits;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Settings"
        title="Billing & usage"
        meta={
          <>
            <StatusBadge>{company.planLabel}</StatusBadge>
            <span>{company.creditsBalance} usage available</span>
            <span>{usage.totalCreditsSpent} total usage</span>
          </>
        }
      />

      <div className="mb-8 grid gap-8 xl:grid-cols-3">
        <SectionBlock title="Plan" icon={CreditCard}>
          <MetricLine label="Current plan" value={<StatusBadge>{company.planLabel}</StatusBadge>} />
          <MetricLine label="Company status" value={<StatusBadge>{company.status}</StatusBadge>} />
          <MetricLine label="Billing email" value={company.billingEmail} />
          <MetricLine label="Usage balance" value={String(company.creditsBalance)} />
          <MetricLine label="Recruiter seats" value={`${team.total} / ${limits.maxRecruiterSeats}`} />
        </SectionBlock>

        <SectionBlock title="Sourcing quotas" icon={Gauge}>
          <LimitLine label="Sourcing flows" used={workspace.activeMissions} limit={limits.maxSourcingFlows} />
          <LimitLine label="Profiles analyzed / month" limit={limits.maxSourcingAnalyses} />
          <LimitLine label="LinkedIn verifications / month" limit={limits.maxLinkedinVerifications} />
          <LimitLine label="Company researches / month" limit={limits.maxCompanyResearches} />
        </SectionBlock>

        <SectionBlock title="Application quotas" icon={Gauge}>
          <LimitLine label="Application flows" used={workspace.activeMissions} limit={limits.maxApplicationFlows} />
          <LimitLine label="CV parses / month" limit={limits.maxCvParses} />
          <LimitLine label="Applications analyzed / month" limit={limits.maxApplicationAnalyses} />
          <LimitLine label="Pipeline generations / month" limit={limits.maxPipelineGenerations} />
        </SectionBlock>
      </div>

      {/* Monthly credit usage */}
      <div className="mb-8 grid gap-8 xl:grid-cols-1">
        <SectionBlock title="Monthly usage" icon={Coins}>
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-foreground/45">Usage this period</span>
              <span className="text-sm font-bold text-foreground">{usage.monthly.totalCredits} / {limits.maxMonthlyCredits}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((usage.monthly.totalCredits / Math.max(1, limits.maxMonthlyCredits)) * 100))}%` }}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(usage.monthly.summary).map(([event, data]) => (
              <div key={event} className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-1">
                  {event.replace(/_/g, " ")}
                </p>
                <p className="text-lg font-black text-foreground">{data.count}</p>
                <p className="text-[11px] text-foreground/40">{data.credits} unit{data.credits !== 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
          {Object.keys(usage.monthly.summary).length === 0 && (
            <p className="text-sm text-foreground/30">No usage this period yet.</p>
          )}
        </SectionBlock>
      </div>

      {/* Credit ledger */}
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
