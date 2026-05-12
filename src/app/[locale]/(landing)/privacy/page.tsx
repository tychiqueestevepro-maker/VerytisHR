import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";

export async function generateMetadata() {
  return { title: "Politique de confidentialité | Verytis" };
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-10"
        >
          <ArrowLeft className="size-3" />
          Retour à l&apos;accueil
        </Link>

        <h1 className="text-4xl font-black mb-2">Politique de confidentialité</h1>
        <p className="text-zinc-500 text-sm mb-12">
          Dernière mise à jour : mai 2025 · Conforme au RGPD (Règlement UE 2016/679)
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-zinc-400">
          <Section title="1. Responsable du traitement">
            <p>
              Le responsable du traitement des données collectées via le site{" "}
              <strong className="text-white">verytis.com</strong> est :
            </p>
            <Card>
              <Row label="Entité" value="EI Tychique Esteve — Verytis" />
              <Row label="SIREN" value="978 543 320" />
              <Row label="Représentant" value="Tychique Esteve" />
              <Row label="Contact" value="contact@verytis.com" />
            </Card>
          </Section>

          <Section title="2. Données collectées">
            <p>
              Nous collectons uniquement les données strictement nécessaires au
              fonctionnement du service :
            </p>
            <ul className="mt-3 space-y-2 list-none">
              {[
                "Données d'identification : prénom, nom, adresse email professionnelle",
                "Données de connexion : adresse IP, horodatage des sessions",
                "Données de profil recruteur : entreprise, poste, préférences d'utilisation",
                "Données candidates importées : profils LinkedIn, CV, réponses aux pipelines d'évaluation",
                "Données d'utilisation : interactions avec la plateforme, crédits consommés",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 size-1.5 rounded-full bg-indigo-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="3. Finalités et bases légales">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-zinc-300 font-semibold">Finalité</th>
                  <th className="text-left py-2 text-zinc-300 font-semibold">Base légale</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Fourniture du service et gestion du compte", "Exécution du contrat (art. 6.1.b)"],
                  ["Amélioration de la plateforme et analyses statistiques", "Intérêt légitime (art. 6.1.f)"],
                  ["Cookies de mesure d'audience", "Consentement (art. 6.1.a)"],
                  ["Vérification de l'identité des candidats", "Intérêt légitime (art. 6.1.f)"],
                  ["Facturation et gestion des crédits", "Obligation légale (art. 6.1.c)"],
                  ["Communications produit et mises à jour", "Intérêt légitime (art. 6.1.f)"],
                ].map(([fin, base]) => (
                  <tr key={fin} className="border-b border-white/[0.05]">
                    <td className="py-2.5 pr-4 text-zinc-400">{fin}</td>
                    <td className="py-2.5 text-zinc-500">{base}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="4. Durée de conservation">
            <ul className="space-y-2 list-none">
              {[
                ["Données de compte", "Durée de l'abonnement + 3 ans après résiliation"],
                ["Données candidates", "Durée d'utilisation de la mission + 12 mois"],
                ["Logs de connexion", "12 mois glissants"],
                ["Données de facturation", "10 ans (obligation comptable)"],
              ].map(([type, duree]) => (
                <li key={type as string} className="flex items-start gap-2">
                  <span className="mt-1 size-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span>
                    <strong className="text-zinc-300">{type}</strong> — {duree}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="5. Destinataires des données">
            <p className="mb-3">
              Vos données sont traitées par Verytis et ses sous-traitants
              techniques, dans le cadre de contrats garantissant un niveau de
              protection équivalent au RGPD :
            </p>
            <Card>
              <Row label="Hébergement" value="Vercel Inc. (USA) — Clauses contractuelles types UE" />
              <Row label="Base de données" value="Supabase Inc. (USA) — Clauses contractuelles types UE" />
              <Row label="IA & modèles LLM" value="Anthropic PBC (USA) — Données non réutilisées pour l'entraînement" />
            </Card>
            <p className="mt-3">
              Aucune donnée n&apos;est vendue ou cédée à des tiers à des fins
              commerciales.
            </p>
          </Section>

          <Section title="6. Vos droits">
            <p className="mb-3">
              Conformément au RGPD, vous disposez des droits suivants sur vos
              données personnelles :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ["Accès", "Obtenir une copie de vos données"],
                ["Rectification", "Corriger des données inexactes"],
                ["Effacement", "Demander la suppression de vos données"],
                ["Portabilité", "Recevoir vos données dans un format structuré"],
                ["Opposition", "Vous opposer à certains traitements"],
                ["Limitation", "Restreindre temporairement un traitement"],
              ].map(([droit, desc]) => (
                <div
                  key={droit as string}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3"
                >
                  <p className="font-semibold text-zinc-300 text-xs">{droit}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-4">
              Pour exercer vos droits :{" "}
              <a
                href="mailto:contact@verytis.com"
                className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                contact@verytis.com
              </a>
              . En cas de litige non résolu, vous pouvez saisir la{" "}
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                CNIL
              </a>
              .
            </p>
          </Section>

          <Section title="7. Cookies">
            <p>
              Verytis utilise des cookies pour le bon fonctionnement du service
              et la mesure d&apos;audience. Vous pouvez gérer votre consentement
              via la bannière affichée à votre première visite. Le refus des
              cookies non essentiels n&apos;affecte pas l&apos;accès au service.
            </p>
          </Section>

          <Section title="8. Sécurité">
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles
              adaptées : chiffrement TLS en transit, données au repos chiffrées,
              contrôle d&apos;accès par rôle (RLS), authentification sécurisée via
              Supabase Auth, et audits réguliers.
            </p>
          </Section>

          <Section title="9. Modifications">
            <p>
              Cette politique peut être mise à jour. En cas de modification
              substantielle, vous serez notifié par email ou via la plateforme
              au moins 30 jours avant l&apos;entrée en vigueur.
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-4 text-xs text-zinc-600">
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Conditions d&apos;utilisation</Link>
            <Link href="/mentions-legales" className="hover:text-zinc-400 transition-colors">Mentions légales</Link>
          </div>
          <p className="text-xs text-zinc-700">© {new Date().getFullYear()} Verytis</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 text-xs">
      <span className="w-44 shrink-0 text-zinc-500">{label}</span>
      <span className="text-zinc-300">{value}</span>
    </div>
  );
}
