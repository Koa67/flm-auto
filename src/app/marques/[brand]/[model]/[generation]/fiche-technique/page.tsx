import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { getGenerationBySlug, genLabel } from "@/lib/vehicle-helpers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { VehicleNav } from "@/components/vehicle-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";

export const revalidate = 3600;

interface Props {
  params: Promise<{ brand: string; model: string; generation: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) return {};
  const title = `Fiche technique ${v.brand.name} ${v.model.name} ${genLabel(v.generation)}`;
  return {
    title,
    description: `Caractéristiques techniques complètes de la ${v.brand.name} ${v.model.name} ${genLabel(v.generation)} : moteur, performances, dimensions, consommation.`,
    alternates: { canonical: `/marques/${bs}/${ms}/${gs}/fiche-technique` },
  };
}

async function getSpecs(generationId: string) {
  const db = createServerClient();
  const { data } = await db
    .from("third_party_specs")
    .select("spec_type, spec_value")
    .eq("generation_id", generationId);
  return data || [];
}

function groupSpecs(specs: { spec_type: string; spec_value: string }[]) {
  const categories: Record<string, { type: string; value: string }[]> = {};

  const categoryMap: Record<string, string> = {
    engine_type: "Moteur",
    engine_displacement: "Moteur",
    engine_power: "Moteur",
    engine_torque: "Moteur",
    engine_cylinders: "Moteur",
    max_power_hp: "Moteur",
    max_torque_nm: "Moteur",
    fuel_type: "Moteur",
    acceleration_0_100: "Performances",
    top_speed: "Performances",
    top_speed_kmh: "Performances",
    "0_100_kmh": "Performances",
    length_mm: "Dimensions",
    width_mm: "Dimensions",
    height_mm: "Dimensions",
    wheelbase_mm: "Dimensions",
    trunk_volume_l: "Dimensions",
    boot_capacity: "Dimensions",
    curb_weight_kg: "Poids",
    gross_weight_kg: "Poids",
    kerb_weight: "Poids",
    transmission_type: "Transmission",
    gearbox: "Transmission",
    drive_type: "Transmission",
    drivetrain: "Transmission",
    number_of_gears: "Transmission",
    fuel_consumption_combined: "Consommation",
    fuel_consumption_urban: "Consommation",
    fuel_consumption_extra_urban: "Consommation",
    co2_emissions: "Consommation",
    wltp_combined: "Consommation",
    electric_range: "Consommation",
    battery_capacity: "Consommation",
  };

  const labelMap: Record<string, string> = {
    engine_type: "Type moteur",
    engine_displacement: "Cylindrée",
    engine_power: "Puissance",
    engine_torque: "Couple",
    engine_cylinders: "Cylindres",
    max_power_hp: "Puissance max",
    max_torque_nm: "Couple max",
    fuel_type: "Carburant",
    acceleration_0_100: "0-100 km/h",
    "0_100_kmh": "0-100 km/h",
    top_speed: "Vitesse max",
    top_speed_kmh: "Vitesse max",
    length_mm: "Longueur",
    width_mm: "Largeur",
    height_mm: "Hauteur",
    wheelbase_mm: "Empattement",
    trunk_volume_l: "Volume coffre",
    boot_capacity: "Volume coffre",
    curb_weight_kg: "Poids à vide",
    gross_weight_kg: "Poids total",
    kerb_weight: "Poids à vide",
    transmission_type: "Transmission",
    gearbox: "Boîte de vitesses",
    drive_type: "Traction",
    drivetrain: "Transmission",
    number_of_gears: "Nombre de rapports",
    fuel_consumption_combined: "Conso. combinée",
    fuel_consumption_urban: "Conso. urbaine",
    fuel_consumption_extra_urban: "Conso. extra-urbaine",
    co2_emissions: "Émissions CO2",
    wltp_combined: "WLTP combiné",
    electric_range: "Autonomie électrique",
    battery_capacity: "Capacité batterie",
  };

  for (const spec of specs) {
    const cat = categoryMap[spec.spec_type] || "Autres";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({
      type: labelMap[spec.spec_type] || spec.spec_type.replace(/_/g, " "),
      value: spec.spec_value,
    });
  }

  const order = [
    "Moteur",
    "Performances",
    "Dimensions",
    "Poids",
    "Transmission",
    "Consommation",
    "Autres",
  ];

  return Object.fromEntries(
    order
      .filter((cat) => categories[cat]?.length > 0)
      .map((cat) => [cat, categories[cat]])
  );
}

export default async function FicheTechniquePage({ params }: Props) {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) notFound();

  const specs = await getSpecs(v.generation.id);
  const grouped = groupSpecs(specs);
  const label = genLabel(v.generation);
  const basePath = `/marques/${bs}/${ms}/${gs}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Marques", href: "/marques" },
          { label: v.brand.name, href: `/marques/${bs}` },
          { label: v.model.name, href: `/marques/${bs}/${ms}` },
          { label: label, href: basePath },
          { label: "Fiche technique" },
        ]}
      />

      <h1 className="mt-4 text-3xl font-bold">
        Fiche technique {v.brand.name} {v.model.name} {label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {specs.length} caractéristiques techniques détaillées.
      </p>

      <div className="mt-6">
        <VehicleNav basePath={basePath} active="fiche-technique" />
      </div>

      <div className="mt-8 space-y-8">
        {Object.entries(grouped).map(([category, items]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {items.map((spec, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3"
                  >
                    <span className="text-muted-foreground">{spec.type}</span>
                    <span className="font-medium">{spec.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {specs.length === 0 && (
          <p className="text-muted-foreground">
            Aucune fiche technique disponible pour ce véhicule.
          </p>
        )}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Car",
            name: `${v.brand.name} ${v.model.name} ${label}`,
            brand: { "@type": "Brand", name: v.brand.name },
            model: v.model.name,
          }),
        }}
      />
    </div>
  );
}
