import { ProfileWizard } from "@/components/profile/profile-wizard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon profil | FLM AUTO",
  description:
    "Créez votre profil conducteur pour recevoir des recommandations personnalisées de véhicules.",
  robots: "noindex",
};

export default function ProfilPage() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Trouvez votre voiture idéale</h1>
        <p className="mt-2 text-muted-foreground">
          Répondez à 5 questions pour recevoir des recommandations
          personnalisées
        </p>
      </div>
      <ProfileWizard />
    </main>
  );
}
