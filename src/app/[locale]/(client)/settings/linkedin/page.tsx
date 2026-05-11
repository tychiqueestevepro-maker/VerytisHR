import { notFound } from "next/navigation";
import { PageHeader } from "@/components/hr/application-components";
import { LinkedinSecureSetup } from "@/components/hr/linkedin-secure-setup";
import { getHrContext } from "@/lib/hr/auth";

export default async function LinkedinSettingsPage() {
  const { companyId } = await getHrContext({ recruiter: true });
  if (!companyId) notFound();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Paramètres"
        title="Connexion LinkedIn"
        meta={
          <>
            <span>Configurez votre accès LinkedIn sécurisé pour l'automatisation.</span>
          </>
        }
      />

      <div className="mt-12 flex flex-col items-center">
        <LinkedinSecureSetup />
      </div>
    </div>
  );
}
