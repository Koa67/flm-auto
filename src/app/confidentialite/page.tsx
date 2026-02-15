import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialit\u00e9",
  description: "Politique de confidentialit\u00e9 et protection des donn\u00e9es personnelles de FLM Auto.",
};

export default function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 font-display text-3xl font-bold sm:text-4xl">Politique de confidentialit&eacute;</h1>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
        <p className="text-muted-foreground">
          Derni&egrave;re mise &agrave; jour : f&eacute;vrier 2026
        </p>

        <section>
          <h2 className="text-xl font-semibold">Responsable du traitement</h2>
          <p>
            Le responsable du traitement des donn&eacute;es est l&rsquo;&eacute;diteur du site
            FLM Auto. Contact : contact@flm-auto.fr
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Donn&eacute;es collect&eacute;es</h2>
          <p>FLM Auto collecte uniquement les donn&eacute;es suivantes :</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              <strong>Compte utilisateur :</strong> adresse email et mot de passe
              (via Supabase Auth, base l&eacute;gale : ex&eacute;cution du contrat).
              N&eacute;cessaire pour les alertes prix, favoris et pr&eacute;f&eacute;rences.
            </li>
            <li>
              <strong>Profil &amp; pr&eacute;f&eacute;rences :</strong> budget, usage, taille
              de famille, priorit&eacute;s (stock&eacute;s en localStorage, non transmis
              au serveur).
            </li>
            <li>
              <strong>Alertes prix :</strong> v&eacute;hicule cible et seuil de prix
              (base l&eacute;gale : consentement). Supprimables &agrave; tout moment.
            </li>
            <li>
              <strong>Newsletter :</strong> adresse email (base l&eacute;gale :
              consentement). Vous pouvez vous d&eacute;sinscrire &agrave; tout moment.
            </li>
            <li>
              <strong>Analytics :</strong> Vercel Analytics collecte des donn&eacute;es
              de navigation anonymis&eacute;es (pages vues, dur&eacute;e de session, type
              d&rsquo;appareil). Aucun cookie de tracking nominatif n&rsquo;est utilis&eacute;.
            </li>
            <li>
              <strong>Performances :</strong> Vercel Speed Insights collecte des
              m&eacute;triques de performance (Core Web Vitals) de mani&egrave;re anonyme.
            </li>
          </ul>
          <p>
            FLM Auto <strong>ne collecte pas</strong> : nom, pr&eacute;nom, adresse
            postale, num&eacute;ro de t&eacute;l&eacute;phone, donn&eacute;es bancaires, ni aucune
            autre donn&eacute;e personnelle.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Cookies</h2>
          <p>FLM Auto utilise les cookies suivants :</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              <strong>Cookies d&rsquo;authentification :</strong> session Supabase Auth
              (n&eacute;cessaire pour acc&eacute;der aux alertes prix et favoris).
            </li>
            <li>
              <strong>Cookies fonctionnels :</strong> pr&eacute;f&eacute;rence de th&egrave;me,
              profil utilisateur, &eacute;tat de l&rsquo;onboarding, badges gamification.
              Stock&eacute;s en localStorage, aucune donn&eacute;e transmise &agrave; des tiers.
            </li>
            <li>
              <strong>Cookies analytiques :</strong> Vercel Analytics peut
              d&eacute;poser un cookie anonyme pour mesurer l&rsquo;audience. Ces donn&eacute;es
              sont agr&eacute;g&eacute;es et ne permettent pas d&rsquo;identifier un utilisateur.
            </li>
          </ul>
          <p>
            Vous pouvez refuser les cookies analytiques via la banni&egrave;re de
            consentement affich&eacute;e lors de votre premi&egrave;re visite, ou &agrave; tout
            moment dans les param&egrave;tres de votre navigateur.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Dur&eacute;e de conservation</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Compte utilisateur : conserv&eacute; jusqu&rsquo;&agrave; suppression du compte</li>
            <li>Alertes prix : conserv&eacute;es jusqu&rsquo;&agrave; d&eacute;sactivation par l&rsquo;utilisateur</li>
            <li>Emails newsletter : conserv&eacute;s jusqu&rsquo;&agrave; d&eacute;sinscription</li>
            <li>Donn&eacute;es analytics : 30 jours (Vercel)</li>
            <li>Cookies fonctionnels : dur&eacute;e de la session ou ind&eacute;finiment en localStorage</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Sous-traitants</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              <strong>Vercel Inc.</strong> (USA) &mdash; H&eacute;bergement et analytics.
              Conforme au Data Privacy Framework UE-US.
            </li>
            <li>
              <strong>Supabase Inc.</strong> (h&eacute;bergement UE) &mdash; Base de
              donn&eacute;es. Donn&eacute;es stock&eacute;es dans l&rsquo;Union europ&eacute;enne.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Vos droits (RGPD)</h2>
          <p>
            Conform&eacute;ment au R&egrave;glement G&eacute;n&eacute;ral sur la Protection des
            Donn&eacute;es (RGPD), vous disposez des droits suivants :
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Droit d&rsquo;acc&egrave;s &agrave; vos donn&eacute;es</li>
            <li>Droit de rectification</li>
            <li>Droit &agrave; l&rsquo;effacement (&laquo; droit &agrave; l&rsquo;oubli &raquo;)</li>
            <li>Droit &agrave; la portabilit&eacute;</li>
            <li>Droit d&rsquo;opposition au traitement</li>
            <li>Droit de retirer votre consentement &agrave; tout moment</li>
          </ul>
          <p>
            Pour exercer ces droits, contactez-nous &agrave; : contact@flm-auto.fr
          </p>
          <p>
            Vous pouvez &eacute;galement introduire une r&eacute;clamation aupr&egrave;s de la{" "}
            <strong>CNIL</strong> (Commission Nationale de l&rsquo;Informatique et des
            Libert&eacute;s) : cnil.fr
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Transferts hors UE</h2>
          <p>
            Certaines donn&eacute;es peuvent &ecirc;tre transf&eacute;r&eacute;es aux &Eacute;tats-Unis
            (Vercel). Ces transferts sont encadr&eacute;s par le Data Privacy
            Framework UE-US, assurant un niveau de protection ad&eacute;quat.
          </p>
        </section>
      </div>
    </div>
  );
}
