"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen items-center justify-center bg-background font-sans text-foreground">
        <div className="flex flex-col items-center px-4 text-center">
          <h1 className="text-4xl font-bold">Erreur critique</h1>
          <p className="mt-4 text-muted-foreground">
            L&apos;application a rencontré un problème inattendu.
          </p>
          <div className="mt-6 flex gap-3">
            <Button onClick={reset}>Réessayer</Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/")}
            >
              Accueil
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
