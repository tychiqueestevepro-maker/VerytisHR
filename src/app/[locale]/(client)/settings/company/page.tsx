import { Building2, Globe2, KeyRound } from "lucide-react";
import { MetricLine, PageHeader, SectionBlock, StatusBadge } from "@/components/hr/application-components";
import { getSettingsWorkspaceData } from "@/lib/hr/settings-workspace";

export default async function CompanySettingsPage() {
  const { company, workspace } = await getSettingsWorkspaceData();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Settings"
        title="Company profile"
        meta={
          <>
            <StatusBadge>{company.status}</StatusBadge>
            <span>{company.plan} plan</span>
            <span>{workspace.activeMissions} active applications</span>
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-2">
        <SectionBlock title="Identity" icon={Building2}>
          <MetricLine label="Company name" value={company.name} />
          <MetricLine label="Legal name" value={company.legalName} />
          <MetricLine label="Slug" value={company.slug} />
          <MetricLine label="Industry" value={company.industry} />
          <MetricLine label="Size" value={company.sizeRange} />
          <MetricLine label="Country" value={company.country} />
        </SectionBlock>

        <SectionBlock title="Web presence" icon={Globe2}>
          <MetricLine label="Website" value={company.websiteUrl} />
          <MetricLine label="LinkedIn" value={company.linkedinUrl} />
          <MetricLine label="Locale" value={company.locale} />
          <MetricLine label="Timezone" value={company.timezone} />
          <MetricLine label="Created" value={company.createdAt} />
        </SectionBlock>

        <SectionBlock title="Billing contact">
          <MetricLine label="Billing email" value={company.billingEmail} />
          <MetricLine label="Credits balance" value={String(company.creditsBalance)} />
          <MetricLine label="Plan" value={<StatusBadge>{company.plan}</StatusBadge>} />
        </SectionBlock>
      </div>
    </div>
  );
}
