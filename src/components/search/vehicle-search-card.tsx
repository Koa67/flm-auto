import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Gauge,
  Fuel,
  Package,
  Shield,
  ArrowRight,
  Zap,
  Timer,
} from "lucide-react";

const FUEL_LABELS: Record<string, string> = {
  petrol: "Essence",
  diesel: "Diesel",
  electric: "Électrique",
  hybrid: "Hybride",
  plugin_hybrid: "PHEV",
};

const FUEL_COLORS: Record<string, string> = {
  petrol: "bg-blue-500/10 text-blue-400",
  diesel: "bg-zinc-500/10 text-zinc-400",
  electric: "bg-emerald-500/10 text-emerald-400",
  hybrid: "bg-teal-500/10 text-teal-400",
  plugin_hybrid: "bg-teal-500/10 text-teal-400",
};

interface VehicleSearchCardProps {
  vehicle: {
    generation_id: string;
    brand: string;
    brand_slug: string;
    model: string;
    model_slug: string;
    generation: string;
    generation_slug: string;
    internal_code?: string | null;
    year_start: number | null;
    year_end: number | null;
    body_style: string | null;
    thumbnail: string | null;
    specs: {
      power_hp: number | null;
      fuel_type: string | null;
      trunk_volume_liters: number | null;
      ncap_rating: number | null;
      acceleration_0_100: number | null;
      top_speed_kmh: number | null;
    };
  };
  view?: "grid" | "list";
}

export function VehicleSearchCard({ vehicle, view = "grid" }: VehicleSearchCardProps) {
  const v = vehicle;
  const href = `/marques/${v.brand_slug}/${v.model_slug}/${v.generation_slug}`;
  const label = `${v.brand} ${v.model}`;
  const genLabel = v.internal_code || v.generation;

  if (view === "list") {
    return (
      <Link href={href}>
        <Card className="card-hover group">
          <CardContent className="flex items-center gap-4 p-3">
            <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-md bg-accent">
              {v.thumbnail ? (
                <Image
                  src={v.thumbnail}
                  alt={label}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground/30">
                  <Fuel className="h-6 w-6" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-white">
                {label} <span className="text-muted-foreground">{genLabel}</span>
              </p>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {v.specs.power_hp && <span>{v.specs.power_hp} ch</span>}
                {v.specs.fuel_type && (
                  <span>{FUEL_LABELS[v.specs.fuel_type] || v.specs.fuel_type}</span>
                )}
                {v.specs.trunk_volume_liters && <span>{v.specs.trunk_volume_liters} L</span>}
                {v.specs.ncap_rating && <span>{"★".repeat(v.specs.ncap_rating)}</span>}
              </div>
            </div>
            {v.year_start && (
              <Badge variant="secondary" className="flex-shrink-0 text-xs">
                {v.year_start}–{v.year_end || "..."}
              </Badge>
            )}
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Grid view
  return (
    <Link href={href}>
      <Card className="card-hover group h-full overflow-hidden">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-accent">
          {v.thumbnail ? (
            <Image
              src={v.thumbnail}
              alt={label}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/20">
              <Fuel className="h-12 w-12" />
            </div>
          )}
          {/* Year badge */}
          {v.year_start && (
            <Badge className="absolute right-2 top-2 bg-background/80 text-xs backdrop-blur-sm">
              {v.year_start}–{v.year_end || "..."}
            </Badge>
          )}
        </div>
        <CardContent className="p-3">
          <p className="truncate text-sm font-semibold text-white">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{genLabel}</p>

          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {v.specs.power_hp && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Gauge className="h-3 w-3" />
                {v.specs.power_hp} ch
              </span>
            )}
            {v.specs.fuel_type && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                  FUEL_COLORS[v.specs.fuel_type] || "bg-accent text-muted-foreground"
                }`}
              >
                <Zap className="h-2.5 w-2.5" />
                {FUEL_LABELS[v.specs.fuel_type] || v.specs.fuel_type}
              </span>
            )}
            {v.specs.trunk_volume_liters && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Package className="h-3 w-3" />
                {v.specs.trunk_volume_liters} L
              </span>
            )}
            {v.specs.ncap_rating && (
              <span className="flex items-center gap-1 text-amber-400">
                <Shield className="h-3 w-3" />
                {"★".repeat(v.specs.ncap_rating)}
              </span>
            )}
            {v.specs.acceleration_0_100 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Timer className="h-3 w-3" />
                {v.specs.acceleration_0_100}s
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
