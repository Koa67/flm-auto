"use client";

import { motion } from "framer-motion";
import { Zap, Gauge, Fuel, Weight, Ruler, Timer, Battery, Cog } from "lucide-react";

interface Spec {
  name: string;
  value: string;
  unit?: string;
  category?: string;
}

const SPEC_ICONS: Record<string, typeof Zap> = {
  power: Zap,
  puissance: Zap,
  torque: Gauge,
  couple: Gauge,
  consumption: Fuel,
  consommation: Fuel,
  weight: Weight,
  poids: Weight,
  length: Ruler,
  longueur: Ruler,
  acceleration: Timer,
  "0-100": Timer,
  battery: Battery,
  batterie: Battery,
  engine: Cog,
  moteur: Cog,
};

const HERO_KEYS = [
  "power",
  "puissance",
  "torque",
  "couple",
  "0-100",
  "acceleration",
  "consumption",
  "consommation",
];

function findIcon(name: string) {
  const key = Object.keys(SPEC_ICONS).find((k) =>
    name.toLowerCase().includes(k)
  );
  return key ? SPEC_ICONS[key] : null;
}

function parseValue(
  value: string,
  unit?: string
): { value: string; unit?: string } {
  if (unit) return { value, unit };
  const match = value.match(/^([\d.,]+)\s*(.*)$/);
  if (match) return { value: match[1], unit: match[2] || undefined };
  return { value };
}

function formatSpecName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\b(mm|cm|kg|kw|hp|nm|l)\b/gi, "")
    .trim();
}

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("engine") || n.includes("motor") || n.includes("cylinder"))
    return "Moteur";
  if (n.includes("dimension") || n.includes("length") || n.includes("width"))
    return "Dimensions";
  if (n.includes("weight") || n.includes("mass")) return "Poids";
  if (n.includes("consumption") || n.includes("fuel") || n.includes("co2"))
    return "Consommation";
  if (n.includes("speed") || n.includes("acceleration"))
    return "Performances";
  if (n.includes("transmission") || n.includes("gear")) return "Transmission";
  return "Autres";
}

export function SpecsCard({
  specs,
  variant = "full",
}: {
  specs: Spec[];
  variant?: "compact" | "full";
}) {
  const heroSpecs = specs
    .filter((s) => HERO_KEYS.some((h) => s.name.toLowerCase().includes(h)))
    .slice(0, 4);

  const otherSpecs = specs.filter((s) => !heroSpecs.includes(s));

  if (variant === "compact") {
    return (
      <div className="flex gap-4">
        {heroSpecs.map((spec, i) => {
          const Icon = findIcon(spec.name);
          const parsed = parseValue(spec.value, spec.unit);
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
              <span className="font-medium">{parsed.value}</span>
              {parsed.unit && (
                <span className="text-muted-foreground">{parsed.unit}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {heroSpecs.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {heroSpecs.map((spec, i) => {
            const Icon = findIcon(spec.name);
            const parsed = parseValue(spec.value, spec.unit);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl bg-muted p-4 text-center"
              >
                {Icon && (
                  <Icon className="mx-auto mb-2 h-5 w-5 text-primary" />
                )}
                <div className="text-3xl font-bold">
                  {parsed.value}
                  {parsed.unit && (
                    <span className="ml-1 text-lg text-muted-foreground">
                      {parsed.unit}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {formatSpecName(spec.name)}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {otherSpecs.length > 0 && <SpecsGrid specs={otherSpecs} />}
    </div>
  );
}

function SpecsGrid({ specs }: { specs: Spec[] }) {
  const grouped = specs.reduce(
    (acc, spec) => {
      const cat = spec.category || guessCategory(spec.name);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(spec);
      return acc;
    },
    {} as Record<string, Spec[]>
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {Object.entries(grouped).map(([category, categorySpecs]) => (
        <div key={category} className="space-y-2">
          <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {category}
          </h4>
          <div className="divide-y rounded-lg border">
            {categorySpecs.map((spec, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2.5"
              >
                <span className="text-sm text-muted-foreground">
                  {formatSpecName(spec.name)}
                </span>
                <span className="text-sm font-medium">
                  {spec.value} {spec.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
