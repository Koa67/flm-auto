import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FUEL_LABELS: Record<string, string> = {
  petrol: "Essence",
  diesel: "Diesel",
  electric: "Électrique",
  hybrid: "Hybride",
  plugin_hybrid: "PHEV",
};

export interface BrowseVehicle {
  generation_id: string;
  brand_name: string;
  brand_slug: string;
  model_name: string;
  model_slug: string;
  generation_name: string;
  generation_slug: string;
  internal_code: string | null;
  year_start: number | null;
  year_end: number | null;
  power_hp: number | null;
  fuel_type: string | null;
  trunk_volume_liters: number | null;
  ncap_stars: number | null;
  thumbnail_url: string | null;
}

export function BrowseGrid({ vehicles }: { vehicles: BrowseVehicle[] }) {
  if (vehicles.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">
          Aucun véhicule trouvé dans cette catégorie.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {vehicles.map((v) => (
        <Link
          key={v.generation_id}
          href={`/marques/${v.brand_slug}/${v.model_slug}/${v.generation_slug}`}
        >
          <Card className="card-hover group h-full overflow-hidden">
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-accent">
              {v.thumbnail_url ? (
                <Image
                  src={v.thumbnail_url}
                  alt={`${v.brand_name} ${v.model_name}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl text-muted-foreground/20">
                  🚗
                </div>
              )}
              {v.year_start && (
                <Badge className="absolute right-2 top-2 bg-background/80 text-xs backdrop-blur-sm">
                  {v.year_start}–{v.year_end || "…"}
                </Badge>
              )}
            </div>
            <CardContent className="p-3">
              <p className="truncate text-sm font-semibold text-white">
                {v.brand_name} {v.model_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {v.internal_code || v.generation_name}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {v.power_hp && <span>{v.power_hp} ch</span>}
                {v.fuel_type && (
                  <span>{FUEL_LABELS[v.fuel_type] || v.fuel_type}</span>
                )}
                {v.trunk_volume_liters && (
                  <span>{v.trunk_volume_liters} L</span>
                )}
                {v.ncap_stars && <span>{"★".repeat(v.ncap_stars)}</span>}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
