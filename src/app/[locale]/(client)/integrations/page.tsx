import { notFound } from "next/navigation";
import { PageHeader } from "@/components/hr/application-components";
import { getSettingsWorkspaceData } from "@/lib/hr/settings-workspace";
import { LinkedinIntegrationCard } from "@/components/hr/linkedin-integration-card";

export default async function IntegrationsPage() {
  const data = await getSettingsWorkspaceData();
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Automation"
        title="Intégrations"
        meta={
          <>
            <span>Connectez vos outils de recrutement au moteur Verytis.</span>
          </>
        }
      />

      <div className="mt-8">
        <LinkedinIntegrationCard 
          accountName={data.linkedin.accountName}
          accountImage={data.linkedin.accountImage}
          lastSyncedAt={data.linkedin.lastSyncedAt}
          lastDetectedIp={data.linkedin.lastDetectedIp}
          lastDetectedCountry={data.linkedin.lastDetectedCountry}
          lastDetectedCity={data.linkedin.lastDetectedCity}
          accounts={data.linkedin.accounts}
        />
      </div>
    </div>
  );
}
