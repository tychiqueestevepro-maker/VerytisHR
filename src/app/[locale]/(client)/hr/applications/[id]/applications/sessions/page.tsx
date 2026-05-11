import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EmptyState, ApplicationTabs, PageHeader, ScoreBadge, StatusBadge, DataTable, LinkedInLink, CVLink, Avatar } from "@/components/hr/application-components";
import { getApplicationWorkspaceData } from "@/lib/hr/application-workspace";
import { pickString, relativeTime } from "@/lib/hr/utils";
import { ApplicationStatusToggle } from "@/components/hr/application-status-toggle";

export default async function ApplicationsSessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Recruitment Cockpit"
        title={String(data.application.title ?? "Mission")}
        actions={
          <div className="flex items-center gap-3">
             <ApplicationStatusToggle applicationId={id} currentStatus={data.status} />
          </div>
        }
        meta={
          <>
            <span>{data.applicationSessions.length} sessions</span>
            <span>{data.progress.responsesReceived} submitted</span>
          </>
        }
      />
      <ApplicationTabs applicationId={id} active="sessions" />

      {data.applicationSessions.length ? (
        <div className="flex flex-col gap-3">
          {data.applicationSessions.map((application) => {
            return (
              <div
                key={application.id}
                className="group relative flex items-center gap-6 rounded-2xl border border-white/40 bg-white/40 p-4 pr-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md transition-all duration-300"
              >
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-pink-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

                <div className="relative flex flex-1 items-center gap-8 pointer-events-none">
                  <div className="flex shrink-0 w-24">
                    <StatusBadge>{application.responseStatus}</StatusBadge>
                  </div>

                  <div className="flex-1 min-w-0 ml-4">
                    <div className="flex items-center gap-4">
                      <Avatar src={application.profileImageUrl} name={application.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-foreground truncate">
                          {application.name}
                        </h3>
                        <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-wider truncate max-w-[500px]">
                          {application.subtitle}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-foreground/30 font-bold uppercase tracking-widest truncate">
                      <span className="font-bold text-foreground/60">Completion: {application.completionLabel}</span>
                      <span className="text-foreground/10 shrink-0">•</span>
                      <span>Created {relativeTime(application.session.created_at)}</span>
                      <span className="text-foreground/10 shrink-0">•</span>
                      <span>{pickString(application.session.submitted_at) ? `Submitted ${relativeTime(application.session.submitted_at)}` : "Not submitted"}</span>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center gap-10 shrink-0 pr-4 z-10">
                  <LinkedInLink url={pickString(application.linkedinUrl)} />
                  <CVLink url={pickString(application.cvUrl)} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No application sessions yet" detail="Generate a pipeline and create candidate links to start receiving applications." />
      )}
    </div>
  );
}
