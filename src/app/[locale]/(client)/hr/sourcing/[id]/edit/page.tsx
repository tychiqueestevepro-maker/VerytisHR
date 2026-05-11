import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionLink, PageHeader } from "@/components/hr/application-components";
import { ApplicationEditForm } from "@/components/hr/application-edit-form";
import { getApplicationWorkspaceData } from "@/lib/hr/application-workspace";
import { getSettingsWorkspaceData } from "@/lib/hr/settings-workspace";

export default async function EditSourcingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  const settingsData = await getSettingsWorkspaceData();
  const members = settingsData.team.members;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Edit sourcing project"
        title={String(data.application.title ?? "Sourcing Project")}
        meta={<span>Update project details, context and settings</span>}
        actions={<ActionLink href={`/hr/sourcing/${id}/settings`} icon={ArrowLeft} variant="secondary">Back to settings</ActionLink>}
      />
      <ApplicationEditForm applicationId={id} initialData={data.application} members={members} />
    </div>
  );
}
