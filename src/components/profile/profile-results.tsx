"use client";

import Link from "next/link";
import { useProfileStore } from "@/lib/profile-store";
import { getRecommendations } from "@/lib/recommendations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCheck, RefreshCcw, ArrowRight } from "lucide-react";

const USAGE_LABELS: Record<string, string> = {
  city: "Ville",
  highway: "Autoroute",
  mixed: "Mixte",
};

const FUEL_LABELS: Record<string, string> = {
  any: "Toute motorisation",
  essence: "Essence",
  diesel: "Diesel",
  electrique: "\u00c9lectrique",
  hybride: "Hybride",
};

const PRIORITY_LABELS: Record<string, string> = {
  economy: "\u00c9conomie",
  safety: "S\u00e9curit\u00e9",
  performance: "Performance",
  space: "Espace",
  reliability: "Fiabilit\u00e9",
  tech: "Technologie",
};

export function ProfileResults() {
  const { profile, resetProfile } = useProfileStore();
  const recs = getRecommendations(profile);

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <UserCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Votre profil</h1>
          <p className="text-sm text-muted-foreground">
            Budget {profile.budget_min.toLocaleString("fr-FR")}&ndash;
            {profile.budget_max.toLocaleString("fr-FR")} &euro; &middot;{" "}
            {USAGE_LABELS[profile.usage] || profile.usage} &middot;{" "}
            {FUEL_LABELS[profile.fuel_preference] || profile.fuel_preference}
          </p>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <Badge variant="secondary">
          {profile.family_size} passager{profile.family_size > 1 ? "s" : ""}
        </Badge>
        {profile.child_seats_needed > 0 && (
          <Badge variant="secondary">
            {profile.child_seats_needed} si&egrave;ge
            {profile.child_seats_needed > 1 ? "s" : ""} enfant
            {profile.child_seats_needed > 1 ? "s" : ""}
          </Badge>
        )}
        {profile.priorities.map((p) => (
          <Badge key={p} variant="outline">
            {PRIORITY_LABELS[p] || p}
          </Badge>
        ))}
      </div>

      <h2 className="mb-4 text-lg font-semibold">Recommandations</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {recs.map((rec) => (
          <Link key={rec.href} href={rec.href}>
            <Card className="card-hover group h-full">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex-1 text-sm font-medium">{rec.label}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="outline" onClick={() => resetProfile()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Modifier
        </Button>
        <Link href="/configurateur">
          <Button>
            Configurateur avanc&eacute;
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </main>
  );
}
