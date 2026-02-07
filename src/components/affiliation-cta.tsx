"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface Props {
  brand: string;
  model: string;
}

function buildLaCentraleUrl(brand: string, model: string) {
  return `https://www.lacentrale.fr/listing?makesModelsCommercialNames=${encodeURIComponent(brand)}%3A${encodeURIComponent(model)}`;
}

function buildAutoScoutUrl(brand: string, model: string) {
  return `https://www.autoscout24.fr/lst/${encodeURIComponent(brand.toLowerCase())}/${encodeURIComponent(model.toLowerCase())}`;
}

export function AffiliationCTA({ brand, model }: Props) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <h3 className="text-lg font-semibold">Vous êtes intéressé ?</h3>

      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-between"
          asChild
        >
          <a
            href={buildLaCentraleUrl(brand, model)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir les annonces sur LaCentrale
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>

        <Button
          variant="outline"
          className="w-full justify-between"
          asChild
        >
          <a
            href={buildAutoScoutUrl(brand, model)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir sur AutoScout24
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Liens vers les sites partenaires.
      </p>
    </div>
  );
}
