import { notFound } from "next/navigation";
import { createStaticClient } from "@/lib/supabase/server";
import { getGenerationBySlug, genLabel } from "@/lib/vehicle-helpers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { VehicleNav } from "@/components/vehicle-nav";
import { BlueprintViewer } from "@/components/blueprints/blueprint-viewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ruler, Box, Weight, Fuel } from "lucide-react";
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

interface ExteriorDims {
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  wheelbase_mm?: number;
  ground_clearance_mm?: number;
  width_with_mirrors_mm?: number;
  turning_circle_m?: number;
}

interface InteriorDims {
  trunk_volume_liters?: number;
  trunk_volume_max_liters?: number;
  frunk_volume_liters?: number;
  fuel_tank_liters?: number;
  seating_capacity?: number;
  front_headroom_mm?: number;
  rear_headroom_mm?: number;
  front_legroom_mm?: number;
  rear_legroom_mm?: number;
  front_shoulder_room_mm?: number;
  rear_shoulder_room_mm?: number;
}

async function getDimensionData(generationId: string) {
  const db = createStaticClient();

  // Get exterior dimensions from third_party_specs exterior_dimensions raw_data
  const { data: extSpec } = await db
    .from("third_party_specs")
    .select("raw_data")
    .eq("generation_id", generationId)
    .eq("spec_type", "exterior_dimensions")
    .limit(1);

  const rawExt = extSpec?.[0]?.raw_data;
  const exterior: ExteriorDims =
    typeof rawExt === "string" ? JSON.parse(rawExt) : rawExt || {};

  // Get weight/consumption specs
  const { data: otherSpecs } = await db
    .from("third_party_specs")
    .select("spec_type, spec_value")
    .eq("generation_id", generationId)
    .in("spec_type", [
      "curb_weight_kg",
      "gross_weight_kg",
      "weight_kg",
      "kerb_weight",
      "fuel_consumption_combined_l_100km",
      "wltp_consumption_combined",
      "turning_circle",
    ]);

  const specMap: Record<string, string> = {};
  for (const s of otherSpecs || []) {
    if (!specMap[s.spec_type]) specMap[s.spec_type] = s.spec_value;
  }

  // Get interior_dimensions
  const { data: intDims } = await db
    .from("interior_dimensions")
    .select("*")
    .eq("generation_id", generationId)
    .limit(1);

  const interior: InteriorDims = intDims?.[0] || {};

  return { exterior, interior, specMap };
}

export default async function DimensionsPage({ params }: Props) {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) notFound();

  const { exterior, interior, specMap } = await getDimensionData(v.generation.id);
  const label = genLabel(v.generation);
  const basePath = `/marques/${bs}/${ms}/${gs}`;

  const hasExterior = exterior.length_mm && exterior.height_mm;
  const hasBlueprintData = exterior.length_mm && exterior.width_mm && exterior.height_mm && exterior.wheelbase_mm;

  // Build dimension rows
  const exteriorRows: { label: string; value: string; unit: string }[] = [];
  if (exterior.length_mm) exteriorRows.push({ label: "Longueur", value: String(exterior.length_mm), unit: "mm" });
  if (exterior.width_mm) exteriorRows.push({ label: "Largeur", value: String(exterior.width_mm), unit: "mm" });
  if (exterior.width_with_mirrors_mm) exteriorRows.push({ label: "Largeur (rétros)", value: String(exterior.width_with_mirrors_mm), unit: "mm" });
  if (exterior.height_mm) exteriorRows.push({ label: "Hauteur", value: String(exterior.height_mm), unit: "mm" });
  if (exterior.wheelbase_mm) exteriorRows.push({ label: "Empattement", value: String(exterior.wheelbase_mm), unit: "mm" });
  if (exterior.ground_clearance_mm) exteriorRows.push({ label: "Garde au sol", value: String(exterior.ground_clearance_mm), unit: "mm" });
  if (exterior.turning_circle_m || specMap.turning_circle) {
    exteriorRows.push({ label: "Diamètre de braquage", value: String(exterior.turning_circle_m || specMap.turning_circle), unit: "m" });
  }

  const interiorRows: { label: string; value: string; unit: string }[] = [];
  if (interior.front_headroom_mm) interiorRows.push({ label: "Hauteur sous toit avant", value: String(interior.front_headroom_mm), unit: "mm" });
  if (interior.rear_headroom_mm) interiorRows.push({ label: "Hauteur sous toit arrière", value: String(interior.rear_headroom_mm), unit: "mm" });
  if (interior.front_legroom_mm) interiorRows.push({ label: "Espace jambes avant", value: String(interior.front_legroom_mm), unit: "mm" });
  if (interior.rear_legroom_mm) interiorRows.push({ label: "Espace jambes arrière", value: String(interior.rear_legroom_mm), unit: "mm" });
  if (interior.front_shoulder_room_mm) interiorRows.push({ label: "Largeur aux épaules avant", value: String(interior.front_shoulder_room_mm), unit: "mm" });
  if (interior.rear_shoulder_room_mm) interiorRows.push({ label: "Largeur aux épaules arrière", value: String(interior.rear_shoulder_room_mm), unit: "mm" });
  if (interior.seating_capacity) interiorRows.push({ label: "Places assises", value: String(interior.seating_capacity), unit: "" });

  const trunkRows: { label: string; value: string; unit: string }[] = [];
  if (interior.trunk_volume_liters) trunkRows.push({ label: "Volume de coffre", value: String(interior.trunk_volume_liters), unit: "L" });
  if (interior.trunk_volume_max_liters) trunkRows.push({ label: "Volume coffre max (sièges rabattus)", value: String(interior.trunk_volume_max_liters), unit: "L" });
  if (interior.frunk_volume_liters) trunkRows.push({ label: "Frunk", value: String(interior.frunk_volume_liters), unit: "L" });
  if (interior.fuel_tank_liters) trunkRows.push({ label: "Réservoir", value: String(interior.fuel_tank_liters), unit: "L" });

  const weightRows: { label: string; value: string; unit: string }[] = [];
  const curbWeight = specMap.curb_weight_kg || specMap.kerb_weight || specMap.weight_kg;
  if (curbWeight) weightRows.push({ label: "Poids à vide", value: curbWeight, unit: "kg" });
  if (specMap.gross_weight_kg) weightRows.push({ label: "Poids total", value: specMap.gross_weight_kg, unit: "kg" });

  const hasAnyData = exteriorRows.length > 0 || interiorRows.length > 0 || trunkRows.length > 0 || weightRows.length > 0;

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

      <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
        Dimensions <span className="text-primary">{v.brand.name} {v.model.name}</span> {label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Dimensions extérieures, habitabilité et volume de coffre.
      </p>

      <div className="mt-6">
        <VehicleNav basePath={basePath} active="dimensions" />
      </div>

      {/* Blueprint Viewer */}
      {hasBlueprintData && (
        <div className="mt-8">
          <BlueprintViewer
            length={exterior.length_mm!}
            width={exterior.width_mm!}
            height={exterior.height_mm!}
            wheelbase={exterior.wheelbase_mm!}
            groundClearance={exterior.ground_clearance_mm}
            label={`${v.brand.name} ${v.model.name} ${label}`}
          />
        </div>
      )}

      <div className="mt-8 space-y-6">
        {exteriorRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5" /> Dimensions extérieures
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DimensionList rows={exteriorRows} />
            </CardContent>
          </Card>
        )}

        {interiorRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" /> Habitabilité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DimensionList rows={interiorRows} />
            </CardContent>
          </Card>
        )}

        {trunkRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5" /> Coffre et rangement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DimensionList rows={trunkRows} />
            </CardContent>
          </Card>
        )}

        {weightRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Weight className="h-5 w-5" /> Poids
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DimensionList rows={weightRows} />
            </CardContent>
          </Card>
        )}

        {!hasAnyData && (
          <p className="text-muted-foreground">
            Aucune donnée dimensionnelle disponible pour ce véhicule.
          </p>
        )}
      </div>
    </div>
  );
}

function DimensionList({
  rows,
}: {
  rows: { label: string; value: string; unit: string }[];
}) {
  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {rows.map((row, i) => (
        <div key={i} className={`flex items-center justify-between py-3 ${i % 2 === 1 ? "surface-3 -mx-4 px-4 rounded" : ""}`}>
          <span className="text-muted-foreground">{row.label}</span>
          <span className="text-mono font-bold text-white">
            {row.value}
            {row.unit && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {row.unit}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
