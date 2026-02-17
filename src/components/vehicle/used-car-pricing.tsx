"use client";

import { useMemo } from "react";
import { TrendingDown } from "lucide-react";
import { getUsedCarPrices } from "@/lib/used-car-prices";

interface Props {
  brandName: string;
  modelName: string;
}

function formatEur(n: number): string {
  return n.toLocaleString("fr-FR") + " \u20ac";
}

export function UsedCarPricing({ brandName, modelName }: Props) {
  const data = useMemo(() => getUsedCarPrices(brandName, modelName), [brandName, modelName]);
  if (!data) return null;

  const maxPrice = data.msrp;

  return (
    <div className="surface-3 rounded-xl border border-[var(--border-subtle)] p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg surface-2">
          <TrendingDown className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Prix occasion estim&eacute;s</h3>
          <p className="text-xs text-muted-foreground">
            Moyennes march&eacute; fran&ccedil;ais &mdash; MSRP neuf : {formatEur(data.msrp)}
          </p>
        </div>
      </div>

      {/* Price bars */}
      <div className="space-y-2">
        {data.prices.slice(1).map(({ age, price }) => {
          const pct = (price / maxPrice) * 100;
          const depreciationPct = Math.round((1 - price / data.msrp) * 100);
          return (
            <div key={age} className="group flex items-center gap-3">
              <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                {age} an{age > 1 ? "s" : ""}
              </span>
              <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-[var(--bg-tertiary)]">
                <div
                  className="h-full rounded-md bg-primary/30 transition-all group-hover:bg-primary/50"
                  style={{ width: `${pct}%` }}
                />
                <span className="absolute inset-y-0 left-2 flex items-center text-xs font-medium text-white">
                  {formatEur(price)}
                </span>
              </div>
              <span className="w-12 shrink-0 text-right text-[11px] font-medium text-red-400">
                -{depreciationPct}%
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        Estimations bas&eacute;es sur les courbes de d&eacute;pr&eacute;ciation DAT/Schwacke. Kilom&eacute;trage moyen.
      </p>
    </div>
  );
}
