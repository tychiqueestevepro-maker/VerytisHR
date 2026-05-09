import { notFound } from "next/navigation";
import { PipelineSessionForm } from "@/components/hr/pipeline-session-form";
import { getPipelineSessionByToken } from "@/lib/hr/pipeline-sessions";
import { asObject, pickString } from "@/lib/hr/utils";

export default async function PublicApplyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPipelineSessionByToken(token);
  if (!data) notFound();

  const unavailable = data.session.status === "expired" || data.session.status === "cancelled" || data.session.status === "failed";
  const mission = asObject(data.application);
  const missionMeta = asObject(mission.metadata);
  const title = pickString(mission.title, data.pipeline?.name) ?? "Application";
  const teamContext = pickString(missionMeta.team_context, missionMeta.company_context, mission.description);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 border-b border-border pb-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/35">Apply</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
          {teamContext ? <p className="mt-2 text-sm leading-6 text-foreground/55">{teamContext}</p> : null}
          {data.pipeline?.description ? <p className="mt-2 text-sm leading-6 text-foreground/45">{data.pipeline.description}</p> : null}
        </header>

        {unavailable ? (
          <div className="border-y border-border py-12 text-center">
            <p className="text-lg font-semibold text-foreground">Application unavailable</p>
            <p className="mt-2 text-sm text-foreground/50">This application link is no longer active.</p>
          </div>
        ) : (
          <PipelineSessionForm token={token} questions={data.questions} status={data.session.status} />
        )}
      </div>
    </main>
  );
}
