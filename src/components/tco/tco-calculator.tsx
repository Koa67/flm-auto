"use client";

import { useState, useMemo } from "react";
import { Calculator, Fuel, Shield, Wrench, FileText, TrendingDown, Euro } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateTCO, calculateMalus2025, type TCOParams, type TCOResult } from "@/lib/tco-calculator";

// ─── Types ─────────────────────────────────────────────

interface VehicleData {
  name: string;
  prixNeuf?: number;
  co2?: number;
  consoL100?: number;
  realConsoL100?: number;
  puissanceCv?: number;
  typeCarburant?: string;
  segment?: string;
}

interface TCOCalculatorProps {
  vehicle: VehicleData;
  vehicleB?: VehicleData;
}

// ─── Helpers ─────────────────────────────────────────────

const FUEL_PRICES: Record<string, number> = {
  essence: 1.75,
  diesel: 1.65,
  electrique: 0.25,
  hybride: 1.75,
  hybride_rechargeable: 1.75,
};

const FUEL_LABELS: Record<string, string> = {
  essence: "Essence",
  diesel: "Diesel",
  electrique: "\u00c9lectrique",
  hybride: "Hybride",
  hybride_rechargeable: "Hybride rechargeable",
};

function formatEur(n: number): string {
  return n.toLocaleString("fr-FR") + " \u20ac";
}

const BAR_COLORS: Record<string, string> = {
  "text-blue-500": "#3b82f6",
  "text-orange-500": "#f97316",
  "text-green-500": "#22c55e",
  "text-purple-500": "#a855f7",
  "text-red-500": "#ef4444",
  "text-gray-500": "#6b7280",
};

// ─── Component ──────────────────────────────────────────

export function TCOCalculator({ vehicle, vehicleB }: TCOCalculatorProps) {
  const fuelType = (vehicle.typeCarburant || "essence") as TCOParams["typeCarburant"];
  const hasRealConso = !!vehicle.realConsoL100;

  const [kmAnnuels, setKmAnnuels] = useState(15000);
  const [dureeMois, setDureeMois] = useState(48);
  const [prixAchat, setPrixAchat] = useState(vehicle.prixNeuf || 35000);
  const [prixCarburant, setPrixCarburant] = useState(FUEL_PRICES[fuelType] || 1.75);
  // Use Spritmonitor real consumption if available, else official, else default
  const [consoL100, setConsoL100] = useState(vehicle.realConsoL100 || vehicle.consoL100 || 6.5);
  const [co2, setCo2] = useState(vehicle.co2 || 130);

  const result = useMemo<TCOResult>(() => {
    return calculateTCO({
      prixAchat,
      dureeDetentionMois: dureeMois,
      kmAnnuels,
      consoReelleL100: consoL100,
      prixCarburantL: prixCarburant,
      emissionsCO2: co2,
      typeCarburant: fuelType,
      puissanceCv: vehicle.puissanceCv || 130,
      segment: vehicle.segment || "berline",
    });
  }, [prixAchat, dureeMois, kmAnnuels, consoL100, prixCarburant, co2, fuelType, vehicle.puissanceCv, vehicle.segment]);

  const malus = calculateMalus2025(co2);

  const costBreakdown = [
    { label: "D\u00e9pr\u00e9ciation", value: result.detailsMensuels.depreciation, icon: TrendingDown, color: "text-blue-500" },
    { label: "Carburant", value: result.detailsMensuels.carburant, icon: Fuel, color: "text-orange-500" },
    { label: "Assurance", value: result.detailsMensuels.assurance, icon: Shield, color: "text-green-500" },
    { label: "Entretien", value: result.detailsMensuels.entretien, icon: Wrench, color: "text-purple-500" },
    { label: "Malus", value: result.detailsMensuels.malus, icon: FileText, color: "text-red-500" },
    { label: "Carte grise", value: result.detailsMensuels.carteGrise, icon: FileText, color: "text-gray-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Calculator className="h-5 w-5" />
          Co\u00fbt r\u00e9el de possession (TCO)
        </h3>
        <p className="text-sm text-muted-foreground">{vehicle.name}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Param\u00e8tres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Prix d'achat */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Prix d&apos;achat : {formatEur(prixAchat)}
              </label>
              <Slider
                value={[prixAchat]}
                onValueChange={([v]) => setPrixAchat(v)}
                min={5000}
                max={150000}
                step={1000}
              />
            </div>

            {/* Km annuels */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Kilom\u00e9trage annuel : {kmAnnuels.toLocaleString("fr-FR")} km
              </label>
              <Slider
                value={[kmAnnuels]}
                onValueChange={([v]) => setKmAnnuels(v)}
                min={5000}
                max={50000}
                step={1000}
              />
            </div>

            {/* Dur\u00e9e */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Dur\u00e9e de d\u00e9tention : {dureeMois / 12} ans ({dureeMois} mois)
              </label>
              <Slider
                value={[dureeMois]}
                onValueChange={([v]) => setDureeMois(v)}
                min={12}
                max={84}
                step={12}
              />
            </div>

            {/* Consommation */}
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <label className="text-sm font-medium">
                  Consommation r&eacute;elle : {consoL100} {fuelType === "electrique" ? "kWh" : "L"}/100 km
                </label>
                {hasRealConso && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Fuel className="h-3 w-3" />
                    Spritmonitor
                  </Badge>
                )}
              </div>
              <Slider
                value={[consoL100]}
                onValueChange={([v]) => setConsoL100(v)}
                min={fuelType === "electrique" ? 10 : 3}
                max={fuelType === "electrique" ? 30 : 15}
                step={0.1}
              />
              {hasRealConso && vehicle.consoL100 && vehicle.consoL100 !== vehicle.realConsoL100 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Conso officielle : {vehicle.consoL100} L/100km
                  {vehicle.realConsoL100 && vehicle.consoL100 > 0 && (
                    <span className="ml-1 text-amber-400">
                      ({Math.round(((vehicle.realConsoL100 - vehicle.consoL100) / vehicle.consoL100) * 100)}% vs officiel)
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Prix carburant */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Prix {fuelType === "electrique" ? "kWh" : "litre"} : {prixCarburant.toFixed(2)} \u20ac
              </label>
              <Slider
                value={[prixCarburant]}
                onValueChange={([v]) => setPrixCarburant(v)}
                min={fuelType === "electrique" ? 0.1 : 1.0}
                max={fuelType === "electrique" ? 0.6 : 2.5}
                step={0.01}
              />
            </div>

            {/* CO2 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Emissions CO2 : {co2} g/km
                {malus > 0 && (
                  <Badge variant="destructive" className="ml-2 text-xs">
                    Malus {formatEur(malus)}
                  </Badge>
                )}
              </label>
              <Slider
                value={[co2]}
                onValueChange={([v]) => setCo2(v)}
                min={0}
                max={300}
                step={1}
              />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {/* Big number */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">Co\u00fbt mensuel</p>
              <p className="text-4xl font-bold text-primary">
                {formatEur(result.mensuel)}
                <span className="text-lg font-normal text-muted-foreground"> /mois</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Total sur {dureeMois / 12} ans : {formatEur(result.total)}
              </p>
            </CardContent>
          </Card>

          {/* Breakdown with colored bars */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">D\u00e9tail mensuel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {costBreakdown
                .filter((c) => c.value > 0)
                .map((c) => {
                  const Icon = c.icon;
                  const pct = result.mensuel > 0 ? Math.round((c.value / result.mensuel) * 100) : 0;
                  return (
                    <div key={c.label}>
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 shrink-0 ${c.color}`} />
                        <span className="flex-1 text-sm">{c.label}</span>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                        <span className="font-mono text-sm font-medium w-20 text-right">
                          {formatEur(c.value)}
                        </span>
                      </div>
                      <div className="mt-1 ml-7 h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: BAR_COLORS[c.color] || "#888" }}
                        />
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>

          {/* One-shot costs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Co\u00fbts ponctuels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-lg font-bold">{formatEur(result.details.malus)}</div>
                  <div className="text-xs text-muted-foreground">Malus 2025</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-lg font-bold">{formatEur(result.details.carteGrise)}</div>
                  <div className="text-xs text-muted-foreground">Carte grise</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
