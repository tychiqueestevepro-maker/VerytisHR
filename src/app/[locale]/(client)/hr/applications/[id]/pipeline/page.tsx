import { redirect } from "next/navigation";

export default async function LegacyMissionPipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/hr/applications/${id}/applications/pipeline`);
}
