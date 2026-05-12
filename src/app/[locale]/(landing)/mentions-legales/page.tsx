export async function generateMetadata() {
  return {
    title: "Mentions légales | Verytis",
  };
}

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-black text-white py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-black mb-2">Mentions légales</h1>
        <p className="text-zinc-500 text-sm mb-12">
          Conformément aux dispositions de la loi n° 2004-575 du 21 juin 2004
          pour la Confiance dans l&apos;Économie Numérique (LCEN).
        </p>

        <div className="space-y-10">
          {/* 1. Éditeur */}
          <section>
            <h2 className="text-xl font-bold mb-4 text-white">
              1. Identification de l&apos;éditeur
            </h2>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-2 text-sm text-zinc-300">
              <Row label="Raison sociale" value="EI Tychique Esteve — Verytis" />
              <Row label="SIREN" value="978 543 320" />
              <Row label="Code APE" value="62.01Z — Programmation informatique" />
              <Row
                label="Directeur de la publication"
                value="Tychique Esteve"
              />
            </div>
          </section>

          {/* 2. Hébergement */}
          <section>
            <h2 className="text-xl font-bold mb-4 text-white">2. Hébergement</h2>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-2 text-sm text-zinc-300">
              <Row label="Société" value="Vercel Inc." />
              <Row
                label="Adresse"
                value="340 S Lemon Ave #4133, Walnut, CA 91789, USA"
              />
              <Row
                label="Site web"
                value={
                  <a
                    href="https://vercel.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                  >
                    https://vercel.com
                  </a>
                }
              />
            </div>
          </section>

          {/* 3. Propriété intellectuelle */}
          <section>
            <h2 className="text-xl font-bold mb-4 text-white">
              3. Propriété intellectuelle
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              L&apos;ensemble du contenu de ce site (textes, images, graphismes,
              logo, icônes, sons, logiciels, etc.) est la propriété exclusive de
              Verytis, à l&apos;exception des éléments issus de tiers auxquels
              des droits spécifiques ont été concédés. Toute reproduction,
              représentation, modification, publication, adaptation de tout ou
              partie des éléments du site, quel que soit le moyen ou le procédé
              utilisé, est interdite, sauf autorisation écrite préalable de
              Verytis.
            </p>
          </section>

          {/* 4. Données personnelles */}
          <section>
            <h2 className="text-xl font-bold mb-4 text-white">
              4. Données personnelles
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Le traitement des données à caractère personnel est régi par notre{" "}
              <a
                href="/privacy"
                className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                Politique de confidentialité
              </a>
              , conformément au Règlement Général sur la Protection des Données
              (RGPD — Règlement UE 2016/679) et à la loi Informatique et
              Libertés.
            </p>
          </section>

          {/* 5. Cookies */}
          <section>
            <h2 className="text-xl font-bold mb-4 text-white">5. Cookies</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Ce site utilise des cookies pour améliorer l&apos;expérience
              utilisateur et réaliser des statistiques de visites. Vous pouvez
              accepter ou refuser les cookies via la bannière affichée lors de
              votre première visite. Votre choix est conservé pour les visites
              suivantes.
            </p>
          </section>

          {/* 6. Droit applicable */}
          <section>
            <h2 className="text-xl font-bold mb-4 text-white">
              6. Droit applicable et juridiction
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Les présentes mentions légales sont soumises au droit français.
              En cas de litige, et à défaut de résolution amiable, les tribunaux
              français seront seuls compétents.
            </p>
          </section>
        </div>

        <p className="mt-16 text-xs text-zinc-600">
          Dernière mise à jour : mai 2025
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <span className="w-52 shrink-0 text-zinc-500">{label}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}
