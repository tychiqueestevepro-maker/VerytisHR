import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EmptyState, ApplicationTabs, PageHeader, ScoreBadge, StatusBadge, DataTable, LinkedInLink, CVLink, Avatar } from "@/components/hr/application-components";
import { getApplicationWorkspaceData } from "@/lib/hr/application-workspace";
import { pickString } from "@/lib/hr/utils";
import { ApplicationStatusToggle } from "@/components/hr/application-status-toggle";

export default async function ApplicationsResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const results = [...data.applicationSessions]
    .filter((application) => application.responseStatus === "Completed" || application.status === "analyzed" || application.pipelineScore !== null)
    .sort((a, b) => (b.pipelineScore ?? -1) - (a.pipelineScore ?? -1));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Recruitment Cockpit"
        title={`Who fits the real work for ${String(data.application.title ?? "Mission")}`}
        actions={
          <div className="flex items-center gap-3">
             <ApplicationStatusToggle applicationId={id} currentStatus={data.status} />
          </div>
        }
        meta={
          <>
            <span>{results.length} applications reviewed</span>
            <span>{data.progress.responsesReceived} responses received</span>
          </>
        }
      />
      <ApplicationTabs applicationId={id} active="results" />

      {results.length ? (
        <div className="flex flex-col gap-3">
          {results.map((application) => {
            const detailUrl = `/hr/applications/${id}/applications/results/${application.id}`;
            return (
              <div
                key={application.id}
                className="group relative flex items-center gap-6 rounded-2xl border border-white/40 bg-white/40 p-4 pr-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md transition-all duration-300 hover:border-pink-500/20 hover:shadow-[0_20px_40px_rgba(236,72,153,0.08)]"
              >
                {/* Background Link */}
                <Link href={detailUrl} className="absolute inset-0 z-0 rounded-2xl" />

                {/* Hover Gradient */}
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-pink-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

                <div className="relative flex flex-1 items-center gap-8 pointer-events-none">
                  <div className="flex-1 min-w-0 ml-4">
                    <div className="flex items-center gap-4">
                      <Avatar src={application.profileImageUrl} name={application.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-foreground group-hover:text-pink-600 transition-colors truncate">
                          {application.name}
                        </h3>
                        <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-wider truncate max-w-[500px]">
                          {application.subtitle}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-foreground/30 font-bold uppercase tracking-widest truncate">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusBadge>{application.integrityStatus}</StatusBadge>
                      </div>
                      <span className="text-foreground/10 shrink-0">•</span>
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums">Paste: {application.pasteAttempts}</span>
                        <span className="opacity-30">/</span>
                        <span className="tabular-nums">Tabs: {application.tabSwitches}</span>
                      </div>
                      <span className="text-foreground/10 shrink-0">•</span>
                      <div className="max-w-[250px] truncate italic">
                        {pickString(application.recommendation) || "No recommendation"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center gap-8 shrink-0 pr-4 z-10">
                  <LinkedInLink url={application.linkedinUrl} />
                  <CVLink url={application.cvUrl} />

                  <div className="flex items-center gap-6 pl-6 border-l border-black/[0.03]">
                    <div className="flex flex-col items-end justify-center min-w-[70px]">
                      <span className="text-[9px] text-foreground/25 font-black uppercase tracking-[0.15em] mb-1">Pipeline</span>
                      <ScoreBadge value={application.pipelineScore} />
                    </div>
                    <div className="flex flex-col items-end justify-center min-w-[70px]">
                      <span className="text-[9px] text-foreground/25 font-black uppercase tracking-[0.15em] mb-1">Fit</span>
                      <ScoreBadge value={application.fitScore} />
                    </div>
                    <div className="flex flex-col items-end justify-center min-w-[70px]">
                      <span className="text-[9px] text-foreground/25 font-black uppercase tracking-[0.15em] mb-1">Team</span>
                      <ScoreBadge value={application.teamFitScore} />
                    </div>
                  </div>

                  <div className="absolute right-[-24px] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none">
                    <ArrowUpRight className="size-5 text-pink-500" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No application results yet" detail="Share a candidate link, receive responses and analyze them to rank inbound applications." />
      )}
    </div>
  );
}
