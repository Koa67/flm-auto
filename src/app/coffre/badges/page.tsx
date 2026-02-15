import type { Metadata } from "next";
import { BadgeGrid } from "@/components/gamification/badge-grid";
import { BADGES } from "@/lib/gamification-store";
import { Trophy } from "lucide-react";

export const metadata: Metadata = {
  title: "Mes Badges",
  description: "Suivez votre progression et d\u00e9bloquez des badges en explorant FLM Auto.",
};

export default function BadgesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Trophy className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Mes Badges</h1>
          <p className="text-sm text-muted-foreground">
            Explore, compare, interroge ALAIN &mdash; d&eacute;bloque les {BADGES.length} badges !
          </p>
        </div>
      </div>

      <BadgeGrid />
    </div>
  );
}
