import { ArrowUpRight, Plus, Trophy, Users, Search, Building2, MapPin, Zap, RefreshCw, User, BarChart3 } from "lucide-react";
import { ActionLink, EmptyState, PageHeader, ScoreBadge, StatusBadge, Pagination } from "@/components/hr/application-components";
import { getApplicationListData } from "@/lib/hr/application-workspace";
import { Link } from "@/i18n/routing";

export default async function SourcingPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageStr } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageStr ?? "1", 10));
  const pageSize = 15;

  const { applications: allApplications } = await getApplicationListData();
  const sourcingApplications = allApplications.filter((m: any) => m.workflowType === "sourcing");

  const total = sourcingApplications.length;
  const applications = sourcingApplications.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex items-end justify-between mb-10">
        <PageHeader
          eyebrow="Talent Intelligence"
          title="Sourcing"
          meta={<div className="flex items-center gap-4">
            <span className="font-bold text-foreground/50 tracking-tight">
              <span className="text-pink-600">{total}</span> {total > 1 ? "Sourcing Projects" : "Sourcing Project"}
            </span>
          </div>}
          actions={<ActionLink href="/hr/sourcing/import" icon={Plus} variant="pink">New sourcing project</ActionLink>}
        />
      </div>

      {total ? (
        <>
          <div className="flex flex-col gap-3">
            {applications.map((mission: any) => (
              <Link
                key={mission.id}
                href={`/hr/sourcing/${mission.id}`}
                className="group relative flex items-center gap-6 rounded-2xl border border-white/40 bg-white/40 p-4 pr-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md transition-all duration-300 hover:border-pink-500/20 hover:shadow-[0_20px_40px_rgba(236,72,153,0.08)]"
              >
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-pink-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                
                <div className="relative flex flex-1 items-center gap-8">
                  {/* Status indicator on the left */}
                  <div className="flex shrink-0 flex-col items-center justify-center w-24">
                     <StatusBadge>{mission.status}</StatusBadge>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-foreground group-hover:text-pink-600 transition-colors truncate">
                      {mission.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-foreground/40 font-medium">
                      <span className="font-bold tracking-tight text-foreground/60 uppercase">{mission.lastActivityType.replaceAll("_", " ")}</span>
                      <span className="text-foreground/10">•</span>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="size-3 text-foreground/20" />
                        <span>{mission.team}</span>
                      </div>
                      <span className="text-foreground/10">•</span>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3 text-foreground/20" />
                        <span>{mission.location}</span>
                      </div>
                      <span className="text-foreground/10">•</span>
                      <div className="flex items-center gap-2 group/manager relative">
                        <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/60 bg-pink-500/10 shadow-sm transition-all duration-300 group-hover/manager:scale-110 group-hover/manager:border-pink-500/40">
                          {mission.managerAvatar ? (
                            <img src={mission.managerAvatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[11px] font-black text-pink-600 uppercase">
                              {mission.manager.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className="absolute left-full ml-3 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-[10px] font-black text-background opacity-0 transition-all duration-300 group-hover/manager:translate-x-0 group-hover/manager:opacity-100 -translate-x-2 pointer-events-none z-20 shadow-xl border border-white/10 uppercase tracking-widest">
                          {mission.manager}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-12 shrink-0 pr-4">
                    <div className="flex flex-col items-center w-20">
                      <span className="text-[9px] uppercase tracking-[0.2em] text-foreground/25 font-black mb-1.5">Profiles</span>
                      <div className="flex items-center gap-1.5 font-bold text-foreground transition-transform group-hover:scale-105">
                        <Search className="size-3.5 text-pink-500/60" />
                        {mission.candidateCount}
                      </div>
                    </div>
                    <div className="flex flex-col items-center w-20">
                      <span className="text-[9px] uppercase tracking-[0.2em] text-foreground/25 font-black mb-1.5">Analyzed</span>
                      <div className="flex items-center gap-1.5 font-bold text-foreground transition-transform group-hover:scale-105">
                        <RefreshCw className="size-3.5 text-amber-500/60" />
                        {mission.analyzedCount}
                      </div>
                    </div>
                    <div className="flex flex-col items-end w-20">
                      <span className="text-[9px] uppercase tracking-[0.2em] text-foreground/25 font-black mb-1.5 text-right">Avg Fit</span>
                      <ScoreBadge value={mission.avgFit} />
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-col items-end justify-center pl-6 border-l border-black/[0.03]">
                   <span className="text-[10px] text-foreground/25 font-black uppercase tracking-[0.15em] mb-1">Update</span>
                   <span className="text-[11px] text-foreground/50 font-bold whitespace-nowrap uppercase tracking-wider">{mission.lastUpdate}</span>
                </div>

                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                  <ArrowUpRight className="size-5 text-pink-500" />
                </div>
              </Link>
            ))}
          </div>
          <Pagination 
            total={total} 
            pageSize={pageSize} 
            currentPage={currentPage} 
            baseUrl="/hr/sourcing" 
          />
        </>
      ) : (
        <EmptyState 
          title="No sourcing projects" 
          detail="Start by describing the mission, the role and the criteria that will be used to judge the imported list." 
        />
      )}
    </div>
  );
}
