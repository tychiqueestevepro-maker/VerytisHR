import { CheckCircle2, Link2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { EmptyState, MetricLine, PageHeader, SectionBlock, StatusBadge } from "@/components/hr/application-components";
import { getSettingsWorkspaceData } from "@/lib/hr/settings-workspace";

function enabledLabel(value: boolean) {
  return value ? "Enabled" : "Disabled";
}

export default async function CriteriaSettingsPage() {
  const { criteria } = await getSettingsWorkspaceData();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Settings"
        title="Criteria"
        meta={
          <>
            <span>Fit threshold {criteria.fitThreshold}</span>
            <span>Trust threshold {criteria.trustThreshold}</span>
          </>
        }
      />

      <div className="mb-10 max-w-2xl">
        <p className="text-sm leading-relaxed text-foreground/50">
          Les critères définissent les seuils de décision automatique et de confiance. 
          Le <span className="font-bold text-foreground/70 text-pink-600">Fit Threshold</span> détermine si un candidat est recommandé, 
          tandis que le <span className="font-bold text-foreground/70 text-pink-600">Trust Threshold</span> assure la cohérence des données (CV vs LinkedIn) 
          avant de valider un score.
        </p>
      </div>

      <div className="mb-8 grid gap-8 xl:grid-cols-2">
        <SectionBlock title="Default scoring" icon={SlidersHorizontal}>
          <MetricLine label="Fit threshold" value={String(criteria.fitThreshold)} />
          <MetricLine label="Trust threshold" value={String(criteria.trustThreshold)} />
          <MetricLine label="LinkedIn verification" value={<StatusBadge>{enabledLabel(criteria.requireLinkedin)}</StatusBadge>} />
          <MetricLine label="CV coherence" value={<StatusBadge>{enabledLabel(criteria.requireCvCoherence)}</StatusBadge>} />
          <MetricLine label="Candidate links" value={<StatusBadge>{enabledLabel(criteria.candidateLinksEnabled)}</StatusBadge>} />
        </SectionBlock>

        <SectionBlock title="Trust gates" icon={ShieldCheck}>
          <MetricLine label="LinkedIn required" value={criteria.requireLinkedin ? "Yes" : "No"} />
          <MetricLine label="CV required" value={criteria.requireCvCoherence ? "Yes" : "No"} />
          <MetricLine label="Review below trust" value={String(criteria.trustThreshold)} />
          <MetricLine label="Review below fit" value={String(criteria.fitThreshold)} />
        </SectionBlock>
      </div>

      <div className="mb-8 grid gap-8 xl:grid-cols-2">
        <SectionBlock title="Must-have skills" icon={CheckCircle2}>
          {criteria.mustHaveSkills.length ? (
            <div className="flex flex-wrap gap-2">
              {criteria.mustHaveSkills.slice(0, 24).map((skill) => (
                <span key={skill} className="inline-flex h-7 items-center rounded-full border border-border bg-secondary/40 px-2.5 text-xs text-foreground/70">
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground/45">No global must-have skills detected from mission metadata.</p>
          )}
        </SectionBlock>

        <SectionBlock title="Nice-to-have skills" icon={Link2}>
          {criteria.niceToHaveSkills.length ? (
            <div className="flex flex-wrap gap-2">
              {criteria.niceToHaveSkills.slice(0, 24).map((skill) => (
                <span key={skill} className="inline-flex h-7 items-center rounded-full border border-border bg-secondary/40 px-2.5 text-xs text-foreground/70">
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground/45">No nice-to-have skills detected from mission metadata.</p>
          )}
        </SectionBlock>
      </div>

      <SectionBlock title="Recent mission criteria">
        {criteria.recentMissions.length ? (
          <div className="overflow-x-auto border-y border-border">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-[0.16em] text-foreground/40">
                  <th className="px-3 py-3 font-medium">Mission</th>
                  <th className="px-3 py-3 font-medium">Seniority</th>
                  <th className="px-3 py-3 font-medium">Difficulty</th>
                  <th className="px-3 py-3 text-right font-medium">Must-have</th>
                  <th className="px-3 py-3 text-right font-medium">Nice-to-have</th>
                  <th className="px-3 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {criteria.recentMissions.map((mission) => (
                  <tr key={mission.id} className="transition hover:bg-secondary/35">
                    <td className="px-3 py-4 font-medium text-foreground">{mission.title}</td>
                    <td className="px-3 py-4 text-foreground/65">{mission.seniority}</td>
                    <td className="px-3 py-4 text-foreground/65">{mission.difficulty}</td>
                    <td className="px-3 py-4 text-right text-foreground/65">{mission.mustHave.length}</td>
                    <td className="px-3 py-4 text-right text-foreground/65">{mission.niceToHave.length}</td>
                    <td className="px-3 py-4 text-foreground/55">{mission.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No criteria yet" detail="Mission-specific criteria will appear after creating your first mission." />
        )}
      </SectionBlock>
    </div>
  );
}
