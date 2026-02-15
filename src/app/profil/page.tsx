"use client";

import { useProfileStore } from "@/lib/profile-store";
import { ProfileWizard } from "@/components/profile/profile-wizard";
import { ProfileResults } from "@/components/profile/profile-results";
import { useEffect, useState } from "react";

export default function ProfilPage() {
  const completed = useProfileStore((s) => s.profile.completed);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  if (completed) return <ProfileResults />;

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Trouvez votre voiture id&eacute;ale</h1>
        <p className="mt-2 text-muted-foreground">
          R&eacute;pondez &agrave; 5 questions pour recevoir des recommandations
          personnalis&eacute;es
        </p>
      </div>
      <ProfileWizard />
    </main>
  );
}
