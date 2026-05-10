import { redirect } from "next/navigation";

export default async function PublicMissionApplyAliasPage({
  params,
}: {
  params: Promise<{ missionSlug: string }>;
}) {
  const { missionSlug } = await params;
  redirect(`/jobs/${missionSlug}/apply`);
}
