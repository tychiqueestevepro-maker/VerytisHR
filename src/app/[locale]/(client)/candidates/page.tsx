import { Search, Building2, ArrowUpRight } from "lucide-react";
import { ActionLink, EmptyState, PageHeader, LinkedInLink, CVLink, Pagination, Avatar } from "@/components/hr/application-components";
import { getCandidatesWorkspaceData } from "@/lib/hr/candidates-workspace";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageStr } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageStr ?? "1", 10));
  const pageSize = 15;

  const { candidates: allCandidates, summary } = await getCandidatesWorkspaceData();
  
  const total = allCandidates.length;
  const candidates = allCandidates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Talent database"
        title="Candidates"
        meta={
          <>
            <span className="font-bold text-foreground">{summary.total}</span>
            <span className="text-foreground/40 font-medium">profiles in the workspace</span>
          </>
        }
        actions={<ActionLink href="/hr/sourcing/import" icon={Search} variant="pink">Import talent</ActionLink>}
      />

      {total ? (
        <>
          <div className="flex flex-col gap-3">
            {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="group relative flex items-center gap-6 rounded-2xl border border-white/40 bg-white/40 p-4 pr-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md transition-all duration-300 hover:border-pink-500/20 hover:shadow-[0_20px_40px_rgba(236,72,153,0.08)]"
            >
              {/* Background Link for the whole card */}
              <Link href={`/candidates/${candidate.id}`} className="absolute inset-0 z-0 rounded-2xl" />

              <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-pink-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
              
              <div className="relative flex flex-1 items-center gap-8 pointer-events-none">
                <div className="flex-1 min-w-0 ml-4">
                  <div className="flex items-center gap-4">
                    <Avatar src={candidate.avatarUrl} name={candidate.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-foreground group-hover:text-pink-600 transition-colors truncate">
                        {candidate.name}
                      </h3>
                      <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-wider truncate max-w-[500px]">
                        {candidate.subtitle}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-foreground/30 font-bold uppercase tracking-widest truncate">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Building2 className="size-3 text-foreground/20" />
                      <span className="truncate max-w-[200px]">{candidate.currentRole}</span>
                    </div>
                    <span className="text-foreground/10 shrink-0">•</span>
                    <span className="truncate max-w-[200px]">{candidate.currentCompany}</span>
                    <span className="text-foreground/10 shrink-0">•</span>
                    <span className="uppercase tracking-wider truncate">{candidate.location}</span>
                  </div>
                </div>
              </div>

              <div className="relative flex items-center gap-10 shrink-0 pr-4 z-10">
                <LinkedInLink url={candidate.linkedinUrl} />
                <CVLink url={candidate.cvUrl} />

                <div className="relative flex flex-col items-end justify-center pl-6 border-l border-black/[0.03] min-w-[120px]">
                  <span className="text-[10px] text-foreground/25 font-black uppercase tracking-[0.15em] mb-1">Last seen</span>
                  <span className="text-[11px] text-foreground/50 font-bold whitespace-nowrap uppercase tracking-wider">{candidate.lastActivity}</span>
                </div>

                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none">
                  <ArrowUpRight className="size-5 text-pink-500" />
                </div>
              </div>
            </div>
            ))}
          </div>
          <Pagination 
            total={total} 
            pageSize={pageSize} 
            currentPage={currentPage} 
            baseUrl="/candidates" 
          />
        </>
      ) : (
        <EmptyState title="No candidates yet" detail="Import candidates from a mission sourcing workspace to start building the talent database." />
      )}
    </div>
  );
}
