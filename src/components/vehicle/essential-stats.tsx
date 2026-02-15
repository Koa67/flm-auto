import { Gauge, Timer, Package, Shield, Zap, Fuel } from "lucide-react";

const FUEL_LABELS: Record<string, string> = {
  petrol: "Essence",
  diesel: "Diesel",
  electric: "Électrique",
  hybrid: "Hybride",
  plugin_hybrid: "PHEV",
};

interface EssentialStatsProps {
  powerHp: number | null;
  torqueNm: number | null;
  acceleration: number | null;
  topSpeed: number | null;
  trunkVolume: number | null;
  safetyStars: number | null;
  fuelType: string | null;
}

export function EssentialStats({
  powerHp,
  torqueNm,
  acceleration,
  topSpeed,
  trunkVolume,
  safetyStars,
  fuelType,
}: EssentialStatsProps) {
  const stats = [
    powerHp && {
      icon: Gauge,
      label: "Puissance",
      value: `${powerHp}`,
      unit: "ch",
    },
    torqueNm && {
      icon: Zap,
      label: "Couple",
      value: `${torqueNm}`,
      unit: "Nm",
    },
    acceleration && {
      icon: Timer,
      label: "0-100 km/h",
      value: `${acceleration}`,
      unit: "s",
    },
    topSpeed && {
      icon: Gauge,
      label: "V.max",
      value: `${topSpeed}`,
      unit: "km/h",
    },
    trunkVolume && {
      icon: Package,
      label: "Coffre",
      value: `${trunkVolume}`,
      unit: "L",
    },
    safetyStars && {
      icon: Shield,
      label: "Euro NCAP",
      value: "★".repeat(safetyStars),
      unit: "",
    },
    fuelType && {
      icon: Fuel,
      label: "Carburant",
      value: FUEL_LABELS[fuelType] || fuelType,
      unit: "",
    },
  ].filter(Boolean) as {
    icon: React.ElementType;
    label: string;
    value: string;
    unit: string;
  }[];

  if (stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="surface-3 flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] p-3 text-center"
          >
            <Icon className="h-4 w-4 text-primary/60" />
            <div className="text-mono text-lg font-bold leading-tight text-white">
              {stat.value}
              {stat.unit && (
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                  {stat.unit}
                </span>
              )}
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
