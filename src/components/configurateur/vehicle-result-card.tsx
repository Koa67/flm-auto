"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Fuel,
  Gauge,
  Package,
  Shield,
  ArrowRight,
  GitCompareArrows,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompareStore } from "@/stores/compare-store";

export interface VehicleResultData {
  generation_id: string;
  brand: string;
  brand_slug: string;
  model: string;
  model_slug: string;
  generation: string;
  generation_slug: string;
  year_start: number | null;
  year_end: number | null;
  score: number;
  thumbnail: string | null;
  specs: {
    power_hp: number | null;
    fuel_type: string | null;
    trunk_volume_liters: number | null;
    ncap_rating: number | null;
    ux_score: number | null;
  };
}

const FUEL_LABELS: Record<string, string> = {
  petrol: "Essence",
  diesel: "Diesel",
  electric: "Electrique",
  hybrid: "Hybride",
  plugin_hybrid: "Hybride rechargeable",
  phev: "PHEV",
  hydrogen: "Hydrogene",
  lpg: "GPL",
  cng: "GNV",
};

function fuelLabel(raw: string | null): string {
  if (!raw) return "N/A";
  return FUEL_LABELS[raw.toLowerCase()] || raw;
}

function scoreColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 60) return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (score >= 40) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

const RANK_STYLES: Record<number, { bg: string; label: string }> = {
  0: { bg: "bg-amber-500 text-black", label: "#1" },
  1: { bg: "bg-gray-300 text-black", label: "#2" },
  2: { bg: "bg-orange-400 text-black", label: "#3" },
};

export function VehicleResultCard({ vehicle, rank }: { vehicle: VehicleResultData; rank?: number }) {
  const addVehicle = useCompareStore((s) => s.addVehicle);
  const vehicles = useCompareStore((s) => s.vehicles);
  const isAdded = vehicles.some((v) => v.id === vehicle.generation_id);
  const isFull = vehicles.length >= 4;

  const href = `/marques/${vehicle.brand_slug}/${vehicle.model_slug}/${vehicle.generation_slug}`;
  const vehicleName = `${vehicle.brand} ${vehicle.model} ${vehicle.generation}`;
  const years = vehicle.year_start
    ? `${vehicle.year_start}\u2013${vehicle.year_end || "..."}`
    : null;

  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      {/* Thumbnail */}
      <Link href={href} className="group block">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-xl bg-muted">
          {vehicle.thumbnail ? (
            <Image
              src={vehicle.thumbnail}
              alt={vehicleName}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Package className="h-10 w-10 opacity-30" />
            </div>
          )}

          {/* Rank + Score badge overlaid */}
          {rank != null && rank < 3 && (
            <div className="absolute left-2 top-2">
              <Badge className={`text-xs font-bold ${RANK_STYLES[rank]?.bg || ""}`}>
                {RANK_STYLES[rank]?.label}
              </Badge>
            </div>
          )}
          <div className="absolute right-2 top-2">
            <Badge className={scoreColor(vehicle.score)}>
              {vehicle.score} pts
            </Badge>
          </div>
        </div>
      </Link>

      <CardContent className="p-4">
        {/* Title */}
        <Link href={href} className="group block">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold">
                {vehicle.brand} {vehicle.model}
              </h3>
              <p className="truncate text-sm text-muted-foreground">
                {vehicle.generation}
                {years && <span className="ml-1">({years})</span>}
              </p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </Link>

        {/* Specs row */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {vehicle.specs.power_hp && (
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              {vehicle.specs.power_hp} ch
            </span>
          )}
          {vehicle.specs.fuel_type && (
            <span className="flex items-center gap-1">
              <Fuel className="h-3 w-3" />
              {fuelLabel(vehicle.specs.fuel_type)}
            </span>
          )}
          {vehicle.specs.trunk_volume_liters && (
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {vehicle.specs.trunk_volume_liters} L
            </span>
          )}
          {vehicle.specs.ncap_rating != null && (
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {"★".repeat(vehicle.specs.ncap_rating)}
              {"☆".repeat(5 - vehicle.specs.ncap_rating)}
            </span>
          )}
        </div>

        {/* Compare quick-add */}
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            disabled={isAdded || isFull}
            className="w-full gap-1.5 text-xs"
            onClick={() =>
              addVehicle({
                id: vehicle.generation_id,
                name: vehicleName,
                image: vehicle.thumbnail || undefined,
              })
            }
          >
            {isAdded ? (
              <>
                <Check className="h-3 w-3" />
                Ajouté au comparateur
              </>
            ) : (
              <>
                <GitCompareArrows className="h-3 w-3" />
                Comparer
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
