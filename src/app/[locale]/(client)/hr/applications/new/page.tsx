import { ArrowLeft } from "lucide-react";
import { ActionLink, PageHeader } from "@/components/hr/application-components";
import { ApplicationCreateForm } from "@/components/hr/application-create-form";

export default function NewMissionPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Mission setup"
        title="New mission"
        meta={<span>Role context, team context and evaluation settings</span>}
        actions={<ActionLink href="/hr/applications" icon={ArrowLeft} variant="secondary">Missions</ActionLink>}
      />
      <ApplicationCreateForm />
    </div>
  );
}
