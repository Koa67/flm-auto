import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions g\u00e9n\u00e9rales d'utilisation",
  description: "Conditions g\u00e9n\u00e9rales d'utilisation du site FLM Auto.",
};

export default function CGUPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 font-display text-3xl font-bold">
        Conditions g&eacute;n&eacute;rales d&rsquo;utilisation
      </h1>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
        <p className="text-muted-foreground">
          Derni&egrave;re mise &agrave; jour : f&eacute;vrier 2026
        </p>

        <section>
          <h2 className="text-xl font-semibold">1. Objet</h2>
          <p>
            Les pr&eacute;sentes conditions g&eacute;n&eacute;rales d&rsquo;utilisation (CGU)
            r&eacute;gissent l&rsquo;acc&egrave;s et l&rsquo;utilisation du site FLM Auto
            (flm-auto.fr), une encyclop&eacute;die automobile en ligne &agrave; vocation
            informative.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Acc&egrave;s au site</h2>
          <p>
            L&rsquo;acc&egrave;s au site est gratuit et ne n&eacute;cessite aucune cr&eacute;ation de
            compte. FLM Auto se r&eacute;serve le droit de suspendre ou
            d&rsquo;interrompre l&rsquo;acc&egrave;s au site &agrave; tout moment, sans pr&eacute;avis, pour
            des raisons de maintenance ou de mise &agrave; jour.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Contenu</h2>
          <p>
            FLM Auto fournit des donn&eacute;es techniques, photos et informations
            sur les v&eacute;hicules automobiles. Ces informations sont fournies{" "}
            <strong>&agrave; titre indicatif</strong> et peuvent contenir des erreurs
            ou des inexactitudes.
          </p>
          <p>
            Les donn&eacute;es proviennent de sources publiques (fiches techniques
            constructeurs, bases ouvertes, Wikipedia, Wikimedia Commons). FLM
            Auto s&rsquo;efforce de maintenir ces donn&eacute;es &agrave; jour mais ne garantit
            pas leur exactitude.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">
            4. Propri&eacute;t&eacute; intellectuelle
          </h2>
          <p>
            Les marques, logos et noms de mod&egrave;les automobiles cit&eacute;s sont la
            propri&eacute;t&eacute; de leurs d&eacute;tenteurs respectifs. Leur utilisation sur ce
            site est purement informative.
          </p>
          <p>
            Les photos utilis&eacute;es sont sous licence Creative Commons (Wikimedia
            Commons) ou libres de droits (Pexels). Chaque image est cr&eacute;dit&eacute;e
            avec sa licence et son auteur.
          </p>
          <p>
            Le code source, le design et les textes originaux de FLM Auto sont
            la propri&eacute;t&eacute; de l&rsquo;&eacute;diteur.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Utilisation acceptable</h2>
          <p>L&rsquo;utilisateur s&rsquo;engage &agrave; :</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              Utiliser le site de mani&egrave;re conforme aux lois en vigueur
            </li>
            <li>
              Ne pas tenter d&rsquo;acc&eacute;der aux syst&egrave;mes ou donn&eacute;es non autoris&eacute;s
            </li>
            <li>
              Ne pas perturber le fonctionnement du site (attaques, scraping
              abusif, spam)
            </li>
            <li>
              Respecter les limites d&rsquo;utilisation de l&rsquo;API (100 requ&ecirc;tes par
              minute)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Newsletter</h2>
          <p>
            L&rsquo;inscription &agrave; la newsletter est volontaire et repose sur le
            consentement. Vous pouvez vous d&eacute;sinscrire &agrave; tout moment en
            cliquant sur le lien de d&eacute;sinscription pr&eacute;sent dans chaque email,
            ou en nous contactant &agrave; contact@flm-auto.fr.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Liens d&rsquo;affiliation</h2>
          <p>
            Certains liens pr&eacute;sents sur le site sont des liens d&rsquo;affiliation.
            Lorsque vous cliquez sur ces liens et r&eacute;alisez un achat, FLM Auto
            peut percevoir une commission. Ces liens sont identifi&eacute;s par la
            mention &laquo; lien sponsoris&eacute; &raquo; ou &laquo; affiliation &raquo;.
            Cela n&rsquo;a aucune incidence sur le prix d&rsquo;achat ni sur nos avis.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">
            8. Limitation de responsabilit&eacute;
          </h2>
          <p>
            FLM Auto ne peut &ecirc;tre tenu responsable des dommages directs ou
            indirects r&eacute;sultant de l&rsquo;utilisation des informations publi&eacute;es
            sur le site. Les donn&eacute;es techniques ne remplacent pas les
            informations officielles des constructeurs.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9. Modification des CGU</h2>
          <p>
            FLM Auto se r&eacute;serve le droit de modifier les pr&eacute;sentes CGU &agrave; tout
            moment. Les utilisateurs seront inform&eacute;s des modifications par la
            mise &agrave; jour de la date en haut de cette page.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">10. Droit applicable</h2>
          <p>
            Les pr&eacute;sentes CGU sont r&eacute;gies par le droit fran&ccedil;ais. Tout
            litige sera soumis aux tribunaux fran&ccedil;ais comp&eacute;tents.
          </p>
        </section>
      </div>
    </div>
  );
}
