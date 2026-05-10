import { redirect } from "next/navigation";

export default async function ApplicationsOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/hr/applications/${id}`);
}
