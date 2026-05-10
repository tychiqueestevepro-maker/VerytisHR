import { notFound } from "next/navigation";
import { PublicMissionApplyForm } from "@/components/hr/public-mission-apply-form";
import { getPublicMissionApplyPage } from "@/lib/hr/public-apply";
import { asObject, pickString } from "@/lib/hr/utils";

export default async function PublicMissionApplyPage({
  params,
}: {
  params: Promise<{ missionSlug: string }>;
}) {
  const { missionSlug } = await params;
  const data = await getPublicMissionApplyPage(missionSlug);
  if (!data) notFound();

  const mission = asObject(data.mission);
  const metadata = asObject(mission.metadata);
  const company = asObject(data.company);
  const title = pickString(mission.title) ?? "Application";
  const companyName = pickString(company.name, mission.department);
  const teamContext = pickString(metadata.team_context, metadata.company_context, mission.description);
  const requireCvUpload = metadata.require_cv_upload !== false;
  const requireLinkedinUrl = metadata.require_linkedin_url !== false;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 border-b border-border pb-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/35">
            {companyName ? `${companyName} application` : "Application"}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-foreground/45">
            {mission.location ? <span>{String(mission.location)}</span> : null}
            {mission.remote_policy ? <span>{String(mission.remote_policy)}</span> : null}
            {mission.employment_type ? <span>{String(mission.employment_type).replaceAll("_", " ")}</span> : null}
          </div>
          {teamContext ? <p className="mt-3 text-sm leading-6 text-foreground/55">{teamContext}</p> : null}
        </header>

        <PublicMissionApplyForm
          missionSlug={missionSlug}
          requireCvUpload={requireCvUpload}
          requireLinkedinUrl={requireLinkedinUrl}
        />
      </div>
    </main>
  );
}
