import { notFound } from "next/navigation";
import { PageHeader, SourcingTabs } from "@/components/hr/application-components";
import { SourcingImportForm } from "@/components/hr/sourcing-import-form";
import { getApplicationWorkspaceData } from "@/lib/hr/application-workspace";

export default async function SourcingImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getApplicationWorkspaceData(id);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Sourcing import"
        title={String(data.application.title ?? "Mission")}
        meta={<span>CSV, CV, LinkedIn URLs, Apollo export or internal base</span>}
      />
      <SourcingTabs applicationId={id} active="import" />
      <SourcingImportForm applicationId={id} />
    </div>
  );
}
