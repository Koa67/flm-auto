"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface Props {
  brand: string;
  model: string;
}

interface Partner {
  name: string;
  buildUrl: (brand: string, model: string) => string;
}

const partners: Partner[] = [
  {
    name: "LaCentrale",
    buildUrl: (brand, model) =>
      `https://www.lacentrale.fr/listing?makesModelsCommercialNames=${encodeURIComponent(brand)}%3A${encodeURIComponent(model)}`,
  },
  {
    name: "AutoScout24",
    buildUrl: (brand, model) =>
      `https://www.autoscout24.fr/lst/${encodeURIComponent(brand.toLowerCase())}/${encodeURIComponent(model.toLowerCase())}`,
  },
  {
    name: "Leboncoin",
    buildUrl: (brand, model) =>
      `https://www.leboncoin.fr/recherche?category=2&text=${encodeURIComponent(`${brand} ${model}`)}`,
  },
  {
    name: "Aramis Auto",
    buildUrl: (brand, model) =>
      `https://www.aramisauto.com/achat/${encodeURIComponent(brand.toLowerCase())}/${encodeURIComponent(model.toLowerCase())}/`,
  },
];

function trackClick(partner: string, brand: string, model: string) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === "function") {
      w.gtag("event", "affiliation_click", {
        partner,
        vehicle: `${brand} ${model}`,
      });
    }
  } catch {}
}

export function AffiliationCTA({ brand, model }: Props) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <h3 className="text-lg font-semibold">Vous êtes intéressé ?</h3>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {partners.map((partner) => (
          <Button
            key={partner.name}
            variant="outline"
            className="w-full justify-between"
            asChild
          >
            <a
              href={partner.buildUrl(brand, model)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick(partner.name, brand, model)}
            >
              Voir sur {partner.name}
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Liens vers les sites partenaires. Nous pouvons percevoir une commission.
      </p>
    </div>
  );
}
