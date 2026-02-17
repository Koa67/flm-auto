import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions l\u00e9gales",
  description: "Mentions l\u00e9gales du site FLM Auto.",
};

export default function MentionsLegalesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 font-display text-3xl font-bold sm:text-4xl">Mentions l&eacute;gales</h1>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold">&Eacute;diteur du site</h2>
          <p>
            Le site <strong>FLM Auto</strong> (flm-auto.fr) est un projet
            personnel &agrave; vocation informative et non commerciale, &eacute;dit&eacute;
            par un particulier.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Responsable de la publication : FLM Auto</li>
            <li>Contact : contact@flm-auto.fr</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">H&eacute;bergement</h2>
          <p>
            Le site est h&eacute;berg&eacute; par <strong>Vercel Inc.</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA</li>
            <li>Site : vercel.com</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Base de donn&eacute;es</h2>
          <p>
            Les donn&eacute;es sont stock&eacute;es via <strong>Supabase</strong> (Supabase
            Inc.), h&eacute;berg&eacute;es dans l&rsquo;Union europ&eacute;enne.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Propri&eacute;t&eacute; intellectuelle</h2>
          <p>
            Les donn&eacute;es techniques des v&eacute;hicules proviennent de sources
            publiques (constructeurs, bases ouvertes, Wikipedia). Les photos sont
            utilis&eacute;es sous licence{" "}
            <strong>Creative Commons</strong> (Wikimedia Commons) ou sont libres
            de droits (Pexels). Chaque image est cr&eacute;dit&eacute;e
            individuellement avec sa licence et son auteur.
          </p>
          <p>
            Les marques, logos et noms de mod&egrave;les cit&eacute;s sont la
            propri&eacute;t&eacute; de leurs d&eacute;tenteurs respectifs. FLM Auto n&rsquo;a
            aucune affiliation avec les constructeurs automobiles.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Liens d&rsquo;affiliation</h2>
          <p>
            Certains liens sur ce site peuvent &ecirc;tre des liens d&rsquo;affiliation.
            Si vous cliquez sur ces liens et effectuez un achat, FLM Auto peut
            recevoir une commission, sans co&ucirc;t suppl&eacute;mentaire pour vous.
            Ces liens sont toujours clairement identifi&eacute;s.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Limitation de responsabilit&eacute;</h2>
          <p>
            Les informations publi&eacute;es sur FLM Auto sont fournies &agrave; titre
            indicatif et ne sauraient se substituer aux donn&eacute;es officielles des
            constructeurs. FLM Auto ne peut &ecirc;tre tenu responsable d&rsquo;erreurs,
            d&rsquo;omissions ou de l&rsquo;utilisation qui pourrait &ecirc;tre faite de ces
            informations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Droit applicable</h2>
          <p>
            Le pr&eacute;sent site est soumis au droit fran&ccedil;ais. Tout litige
            relatif &agrave; son utilisation sera de la comp&eacute;tence exclusive des
            tribunaux fran&ccedil;ais.
          </p>
        </section>
      </div>
    </div>
  );
}
