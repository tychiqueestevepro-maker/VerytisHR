import { redirect } from "next/navigation";

export default async function LegacyMissionResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/hr/sourcing/${id}/results`);
}
