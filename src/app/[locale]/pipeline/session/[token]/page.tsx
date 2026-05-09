import { redirect } from "next/navigation";

export default async function LegacyPipelineSessionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/apply/${token}`);
}
