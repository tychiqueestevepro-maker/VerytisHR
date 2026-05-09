import { ArrowUpRight, Plus } from "lucide-react";
import { ActionLink, EmptyState, PageHeader, ScoreBadge, StatusBadge } from "@/components/hr/application-components";
import { getApplicationListData } from "@/lib/hr/application-workspace";
import { ApplicationsFilter } from "@/components/hr/applications-filter";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const { applications: allApplications } = await getApplicationListData();
  const applicationApplications = allApplications.filter((m: any) => m.workflowType === "application");

  const applications = status && status !== "all"
    ? applicationApplications.filter((m: any) => m.status === status)
    : applicationApplications;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex items-end justify-between mb-8">
        <PageHeader
          eyebrow="Recruitment flow"
          title="Applications"
          meta={<div className="flex items-center gap-4">
            <ApplicationsFilter />
            <span className="text-foreground/30">|</span>
            <span>{applications.length} applications</span>
          </div>}
          actions={<ActionLink href="/hr/applications/new" icon={Plus}>New application</ActionLink>}
        />
      </div>

      {applications.length ? (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[1040px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-[11px] uppercase tracking-[0.16em] text-foreground/40">
                <th className="px-3 py-3 font-medium">Application</th>
                <th className="px-3 py-3 font-medium">Team</th>
                <th className="px-3 py-3 font-medium">Location</th>
                <th className="px-3 py-3 text-right font-medium">Applicants</th>
                <th className="px-3 py-3 text-right font-medium">Analyzed</th>
                <th className="px-3 py-3 text-right font-medium">Avg Fit</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Last update</th>
                <th className="px-3 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {applications.map((mission: any) => (
                <tr key={mission.id} className="transition hover:bg-secondary/35">
                  <td className="px-3 py-4">
                    <div className="font-medium text-foreground">{mission.title}</div>
                    <div className="mt-1 text-xs text-foreground/40">{mission.lastActivityType.replaceAll("_", " ")}</div>
                  </td>
                  <td className="px-3 py-4 text-foreground/65">{mission.team}</td>
                  <td className="px-3 py-4 text-foreground/65">{mission.location}</td>
                  <td className="px-3 py-4 text-right font-medium">{mission.applicationCount}</td>
                  <td className="px-3 py-4 text-right font-medium">{mission.analyzedCount}</td>
                  <td className="px-3 py-4 text-right"><ScoreBadge value={mission.avgFit} /></td>
                  <td className="px-3 py-4"><StatusBadge>{mission.status}</StatusBadge></td>
                  <td className="px-3 py-4 text-foreground/55">{mission.lastUpdate}</td>
                  <td className="px-3 py-4 text-right">
                    <a
                      href={`/hr/applications/${mission.id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground"
                    >
                      Open
                      <ArrowUpRight className="size-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No applications yet" detail="Create the first application with job context, team context and evaluation settings." />
      )}
    </div>
  );
}
