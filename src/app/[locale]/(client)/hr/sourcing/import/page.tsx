import { ArrowLeft } from "lucide-react";
import { ActionLink, PageHeader } from "@/components/hr/application-components";
import { ImportTargetForm } from "@/components/hr/import-target-form";

export default function QualificationImportPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Imported candidates"
        title="Qualification target"
        meta={<span>Define the mission and criteria before importing profiles</span>}
        actions={<ActionLink href="/hr/sourcing" icon={ArrowLeft} variant="secondary">Qualification</ActionLink>}
      />
      <ImportTargetForm />
    </div>
  );
}
