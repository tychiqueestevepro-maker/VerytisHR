import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";

export async function generateMetadata() {
  return { title: "Conditions d'utilisation | Verytis" };
}

export default function TermsPage() {
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

        <h1 className="text-4xl font-black mb-2">Conditions d&apos;utilisation</h1>
        <p className="text-zinc-500 text-sm mb-12">
          Dernière mise à jour : mai 2025 · En utilisant Verytis, vous acceptez
          ces conditions dans leur intégralité.
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-zinc-400">
          <Section title="1. Objet">
            <p>
              Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent
              l&apos;accès et l&apos;utilisation de la plateforme{" "}
              <strong className="text-white">Verytis</strong>, éditée par EI
              Tychique Esteve (SIREN 978 543 320). La plateforme propose des
              outils d&apos;aide au recrutement basés sur l&apos;intelligence artificielle,
              notamment la vérification de CV, la mise en correspondance avec
              LinkedIn et la génération de pipelines d&apos;évaluation.
            </p>
          </Section>

          <Section title="2. Accès au service">
            <p>
              L&apos;accès à Verytis est réservé aux professionnels du recrutement
              (recruteurs, DRH, cabinets de conseil). La création d&apos;un compte
              implique l&apos;acceptation des présentes CGU.
            </p>
            <p className="mt-2">
              Pendant la phase bêta, l&apos;accès est soumis à validation manuelle.
              Verytis se réserve le droit de refuser ou de suspendre tout accès
              sans justification.
            </p>
          </Section>

          <Section title="3. Crédits et facturation">
            <div className="space-y-3">
              <p>
                Le service fonctionne sur un système de crédits. Chaque opération
                IA (analyse, vérification, scoring) consomme un nombre défini de
                crédits.
              </p>
              <Callout>
                <strong className="text-white">Accès Bêta :</strong> 200 crédits
                offerts à l&apos;inscription, sans carte bancaire requise. Les crédits
                non utilisés ne sont pas remboursables et expirent à la fin de la
                période bêta.
              </Callout>
              <p>
                Les tarifs de la version Pro seront communiqués avant la
                fin de la phase bêta. Tout changement tarifaire sera notifié 30
                jours à l&apos;avance.
              </p>
            </div>
          </Section>

          <Section title="4. Utilisation acceptable">
            <p className="mb-3">L&apos;utilisateur s&apos;engage à :</p>
            <ul className="space-y-2">
              {[
                "N'utiliser la plateforme qu'à des fins professionnelles légitimes de recrutement",
                "Respecter la vie privée des candidats dont les données sont importées",
                "Informer les candidats du traitement de leurs données personnelles",
                "Ne pas importer de données obtenues de manière illicite",
                "Ne pas tenter de contourner les mécanismes de sécurité de la plateforme",
                "Ne pas utiliser le service pour prendre des décisions entièrement automatisées sans supervision humaine",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 size-1.5 rounded-full bg-indigo-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="5. Données candidates et RGPD">
            <p className="mb-3">
              L&apos;utilisateur est{" "}
              <strong className="text-white">responsable de traitement</strong>{" "}
              pour les données candidates qu&apos;il importe. Verytis agit en qualité
              de <strong className="text-white">sous-traitant</strong> au sens de
              l&apos;article 28 du RGPD.
            </p>
            <p>
              L&apos;utilisateur garantit avoir obtenu, ou avoir la base légale
              nécessaire pour traiter les données des candidats (intérêt légitime
              de recrutement ou consentement explicite), conformément au RGPD et
              à la loi Informatique et Libertés.
            </p>
            <Callout className="mt-3">
              Verytis ne vend, ne loue et ne partage aucune donnée candidate
              avec des tiers. Les données sont utilisées exclusivement pour
              fournir le service commandé.
            </Callout>
          </Section>

          <Section title="6. Propriété intellectuelle">
            <p>
              La plateforme Verytis, son code source, ses modèles, son design et
              l&apos;ensemble de ses contenus sont la propriété exclusive d&apos;EI Tychique
              Esteve. Toute reproduction, même partielle, est interdite sans
              autorisation écrite préalable.
            </p>
            <p className="mt-2">
              Les données importées par l&apos;utilisateur (CV, profils, fichiers)
              restent sa propriété. Verytis n&apos;acquiert aucun droit de propriété
              sur ces données.
            </p>
          </Section>

          <Section title="7. Disponibilité et maintenance">
            <p>
              Verytis s&apos;efforce d&apos;assurer une disponibilité maximale du service,
              sans toutefois la garantir. Des interruptions pour maintenance
              peuvent survenir, de préférence en dehors des heures ouvrées.
              Pendant la phase bêta, le service est fourni{" "}
              <em>&quot;en l&apos;état&quot;</em> sans engagement de SLA.
            </p>
          </Section>

          <Section title="8. Limitation de responsabilité">
            <p>
              Verytis est un outil d&apos;aide à la décision. Les scores, analyses et
              recommandations générés par l&apos;IA sont indicatifs et ne constituent
              pas des décisions automatisées. La décision finale de recrutement
              relève exclusivement de l&apos;utilisateur.
            </p>
            <p className="mt-2">
              Verytis ne peut être tenu responsable des préjudices indirects,
              des pertes de données ou des décisions de recrutement prises sur la
              base des analyses fournies par la plateforme.
            </p>
          </Section>

          <Section title="9. Résiliation">
            <p>
              L&apos;utilisateur peut supprimer son compte à tout moment depuis les
              paramètres de la plateforme. Les données sont supprimées dans un
              délai de 30 jours suivant la demande, sauf obligation légale de
              conservation.
            </p>
            <p className="mt-2">
              Verytis peut résilier un accès en cas de violation des présentes
              CGU, après mise en demeure restée sans effet pendant 48 heures.
            </p>
          </Section>

          <Section title="10. Modifications des CGU">
            <p>
              Verytis se réserve le droit de modifier les présentes CGU. Toute
              modification substantielle sera notifiée par email au moins 15
              jours avant son entrée en vigueur. La poursuite de l&apos;utilisation
              du service vaut acceptation des nouvelles conditions.
            </p>
          </Section>

          <Section title="11. Droit applicable et litiges">
            <p>
              Les présentes CGU sont soumises au droit français. En cas de
              litige, les parties s&apos;engagent à rechercher une solution amiable
              dans un délai de 30 jours. À défaut, les tribunaux compétents du
              ressort de Paris seront seuls compétents.
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-4 text-xs text-zinc-600">
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Politique de confidentialité</Link>
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

function Callout({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-indigo-500/20 bg-indigo-500/[0.07] px-4 py-3 text-zinc-400 ${className}`}>
      {children}
    </div>
  );
}
