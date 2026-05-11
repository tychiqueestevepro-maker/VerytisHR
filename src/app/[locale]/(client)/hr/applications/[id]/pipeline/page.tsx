import { redirect } from "next/navigation";
import { ActionLink, ApplicationTabs, PageHeader, SectionBlock, StatusBadge } from "@/components/hr/application-components";
import { ApplicationStatusToggle } from "@/components/hr/application-status-toggle";
import { PipelineTimeline } from "@/components/hr/pipeline-timeline";

export default async function LegacyMissionPipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/hr/applications/${id}/applications/pipeline`);
}
