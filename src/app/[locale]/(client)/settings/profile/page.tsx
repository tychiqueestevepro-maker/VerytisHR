import { ArrowLeft } from "lucide-react";
import { ActionLink, PageHeader } from "@/components/hr/application-components";
import { getSettingsWorkspaceData } from "@/lib/hr/settings-workspace";
import { ProfileSettingsForm } from "@/components/hr/profile-settings-form";

export default async function ProfileSettingsPage() {
  const data = await getSettingsWorkspaceData();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Settings"
        title="Personal Profile"
        meta={<span>Manage your identity and profile photo</span>}
        actions={<ActionLink href="/settings" icon={ArrowLeft} variant="secondary">Back to settings</ActionLink>}
      />

      <div className="mt-10">
        <ProfileSettingsForm user={data.user} />
      </div>
    </div>
  );
}
