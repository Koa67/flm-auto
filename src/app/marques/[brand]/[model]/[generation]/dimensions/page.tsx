import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { getGenerationBySlug, genLabel } from "@/lib/vehicle-helpers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { VehicleNav } from "@/components/vehicle-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ruler, Box, Weight } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 3600;

interface Props {
  params: Promise<{ brand: string; model: string; generation: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) return {};
  const label = genLabel(v.generation);
  return {
    title: `Dimensions ${v.brand.name} ${v.model.name} ${label}`,
    description: `Dimensions et habitabilité de la ${v.brand.name} ${v.model.name} ${label} : longueur, largeur, hauteur, empattement, volume de coffre.`,
    alternates: { canonical: `/marques/${bs}/${ms}/${gs}/dimensions` },
  };
}

async function getDimensions(generationId: string) {
  const db = createServerClient();

  const dimensionTypes = [
    "length_mm",
    "width_mm",
    "height_mm",
    "wheelbase_mm",
    "trunk_volume_l",
    "boot_capacity",
    "curb_weight_kg",
    "gross_weight_kg",
    "kerb_weight",
    "ground_clearance",
    "turning_circle",
    "fuel_tank_capacity",
    "rear_legroom",
    "front_legroom",
    "rear_headroom",
    "front_headroom",
    "cargo_volume",
  ];

  const { data } = await db
    .from("third_party_specs")
    .select("spec_type, spec_value")
    .eq("generation_id", generationId)
    .in("spec_type", dimensionTypes);

  return data || [];
}

const labels: Record<string, { label: string; unit: string }> = {
  length_mm: { label: "Longueur", unit: "mm" },
  width_mm: { label: "Largeur", unit: "mm" },
  height_mm: { label: "Hauteur", unit: "mm" },
  wheelbase_mm: { label: "Empattement", unit: "mm" },
  trunk_volume_l: { label: "Volume de coffre", unit: "L" },
  boot_capacity: { label: "Capacité du coffre", unit: "L" },
  curb_weight_kg: { label: "Poids à vide", unit: "kg" },
  gross_weight_kg: { label: "Poids total", unit: "kg" },
  kerb_weight: { label: "Poids à vide", unit: "kg" },
  ground_clearance: { label: "Garde au sol", unit: "mm" },
  turning_circle: { label: "Diamètre de braquage", unit: "m" },
  fuel_tank_capacity: { label: "Réservoir", unit: "L" },
  rear_legroom: { label: "Espace jambes arrière", unit: "mm" },
  front_legroom: { label: "Espace jambes avant", unit: "mm" },
  rear_headroom: { label: "Hauteur sous toit arrière", unit: "mm" },
  front_headroom: { label: "Hauteur sous toit avant", unit: "mm" },
  cargo_volume: { label: "Volume de chargement", unit: "L" },
};

export default async function DimensionsPage({ params }: Props) {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) notFound();

  const dims = await getDimensions(v.generation.id);
  const label = genLabel(v.generation);
  const basePath = `/marques/${bs}/${ms}/${gs}`;

  const exterior = dims.filter((d) =>
    ["length_mm", "width_mm", "height_mm", "wheelbase_mm", "ground_clearance", "turning_circle"].includes(d.spec_type)
  );
  const interior = dims.filter((d) =>
    ["trunk_volume_l", "boot_capacity", "cargo_volume", "rear_legroom", "front_legroom", "rear_headroom", "front_headroom", "fuel_tank_capacity"].includes(d.spec_type)
  );
  const weights = dims.filter((d) =>
    ["curb_weight_kg", "gross_weight_kg", "kerb_weight"].includes(d.spec_type)
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Marques", href: "/marques" },
          { label: v.brand.name, href: `/marques/${bs}` },
          { label: v.model.name, href: `/marques/${bs}/${ms}` },
          { label: label, href: basePath },
          { label: "Dimensions" },
        ]}
      />

      <h1 className="mt-4 text-3xl font-bold">
        Dimensions {v.brand.name} {v.model.name} {label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Dimensions extérieures, habitabilité et volume de coffre.
      </p>

      <div className="mt-6">
        <VehicleNav basePath={basePath} active="dimensions" />
      </div>

      <div className="mt-8 space-y-6">
        {exterior.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5" /> Dimensions extérieures
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DimensionList specs={exterior} />
            </CardContent>
          </Card>
        )}

        {interior.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" /> Habitabilité et coffre
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DimensionList specs={interior} />
            </CardContent>
          </Card>
        )}

        {weights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Weight className="h-5 w-5" /> Poids
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DimensionList specs={weights} />
            </CardContent>
          </Card>
        )}

        {dims.length === 0 && (
          <p className="text-muted-foreground">
            Aucune donnée dimensionnelle disponible pour ce véhicule.
          </p>
        )}
      </div>
    </div>
  );
}

function DimensionList({
  specs,
}: {
  specs: { spec_type: string; spec_value: string }[];
}) {
  return (
    <div className="divide-y">
      {specs.map((spec, i) => {
        const info = labels[spec.spec_type];
        return (
          <div key={i} className="flex items-center justify-between py-3">
            <span className="text-muted-foreground">
              {info?.label || spec.spec_type.replace(/_/g, " ")}
            </span>
            <span className="font-medium">
              {spec.spec_value}
              {info?.unit && (
                <span className="ml-1 text-sm text-muted-foreground">
                  {info.unit}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
