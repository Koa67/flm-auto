import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { getGenerationBySlug, genLabel } from "@/lib/vehicle-helpers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { VehicleNav } from "@/components/vehicle-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Shield, Star } from "lucide-react";
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
    title: `Sécurité ${v.brand.name} ${v.model.name} ${label} — Euro NCAP`,
    description: `Note de sécurité Euro NCAP de la ${v.brand.name} ${v.model.name} ${label} : protection adultes, enfants, piétons et aide à la conduite.`,
    alternates: { canonical: `/marques/${bs}/${ms}/${gs}/securite` },
  };
}

async function getSafetyData(generationId: string) {
  const db = createServerClient();
  const { data } = await db
    .from("safety_ratings")
    .select("*")
    .eq("generation_id", generationId)
    .order("test_year", { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

export default async function SecuritePage({ params }: Props) {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) notFound();

  const safety = await getSafetyData(v.generation.id);
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
          { label: "Sécurité" },
        ]}
      />

      <h1 className="mt-4 text-3xl font-bold">
        Sécurité {v.brand.name} {v.model.name} {label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Résultats des crash-tests Euro NCAP et note de sécurité.
      </p>

      <div className="mt-6">
        <VehicleNav basePath={basePath} active="securite" />
      </div>

      <div className="mt-8">
        {safety ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  Euro NCAP {safety.test_year}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-8 w-8 ${
                        i < (safety.stars || 0)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                  <span className="ml-3 text-2xl font-bold">
                    {safety.stars}/5 étoiles
                  </span>
                </div>

                <div className="space-y-6">
                  {safety.adult_occupant_pct != null && (
                    <ScoreSection
                      label="Protection des adultes"
                      value={safety.adult_occupant_pct}
                      description="Score basé sur les crash-tests frontaux, latéraux et de retournement. Évalue la protection du conducteur et des passagers adultes."
                    />
                  )}
                  {safety.child_occupant_pct != null && (
                    <ScoreSection
                      label="Protection des enfants"
                      value={safety.child_occupant_pct}
                      description="Évalue la protection des enfants de 6 et 10 ans lors des crash-tests, ainsi que la facilité d'installation des sièges enfants."
                    />
                  )}
                  {safety.pedestrian_pct != null && (
                    <ScoreSection
                      label="Protection des piétons"
                      value={safety.pedestrian_pct}
                      description="Mesure l'impact du véhicule sur les piétons et cyclistes en cas de collision, incluant le freinage d'urgence automatique."
                    />
                  )}
                  {safety.safety_assist_pct != null && (
                    <ScoreSection
                      label="Aide à la conduite"
                      value={safety.safety_assist_pct}
                      description="Évalue les systèmes d'assistance : freinage d'urgence, alerte de franchissement de ligne, régulateur adaptatif, etc."
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {safety.source_url && (
              <p className="text-sm text-muted-foreground">
                Source :{" "}
                <a
                  href={safety.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Euro NCAP
                </a>
              </p>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">
                Pas de données Euro NCAP
              </h2>
              <p className="mt-2 text-muted-foreground">
                Ce véhicule n&apos;a pas encore été testé par Euro NCAP ou les
                résultats ne sont pas disponibles.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ScoreSection({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  const color =
    value >= 80
      ? "text-green-600"
      : value >= 60
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className={`font-mono font-bold ${color}`}>{value}%</span>
      </div>
      <Progress value={value} className="h-3" />
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
