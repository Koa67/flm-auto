"use client";

import { Badge } from "@/components/ui/badge";

type Tier = "A" | "B" | "C" | "D" | "E";

const tierConfig: Record<
  Tier,
  { label: string; color: string; icon: string; tooltip: string }
> = {
  A: {
    label: "Vérifié",
    color: "bg-green-500/10 text-green-400 border-green-500/20",
    icon: "✓",
    tooltip: "Donnée vérifiée (source officielle)",
  },
  B: {
    label: "Fiable",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: "~",
    tooltip: "Donnée fiable (propagée depuis une source vérifiée)",
  },
  C: {
    label: "Estimé",
    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    icon: "≈",
    tooltip: "Estimation (basée sur des données proches)",
  },
  D: {
    label: "Inféré",
    color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    icon: "?",
    tooltip: "Inférence (estimation heuristique)",
  },
  E: {
    label: "Non fiable",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: "!",
    tooltip: "Données suspectes — fiabilité non garantie",
  },
};

interface ConfidenceBadgeProps {
  tier: string | null | undefined;
  size?: "sm" | "default";
  className?: string;
}

export function ConfidenceBadge({
  tier,
  size = "default",
  className = "",
}: ConfidenceBadgeProps) {
  // Never display E-tier data
  if (!tier || tier === "E" || !(tier in tierConfig)) return null;
  const config = tierConfig[tier as Tier];

  return (
    <Badge
      variant="outline"
      className={`cursor-help ${config.color} ${size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"} ${className}`}
      title={config.tooltip}
      aria-label={config.tooltip}
    >
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  );
}
