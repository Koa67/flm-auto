import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";
import { generateBreadcrumbSchema } from "@/lib/schema/breadcrumb-schema";

export const revalidate = 3600;

interface Props {
  params: Promise<{ brand: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: slug } = await params;
  const db = createServerClient();
  const { data } = await db
    .from("brands")
    .select("name")
    .eq("slug", slug)
    .single();
  if (!data) return {};
  return {
    title: `${data.name} \u2014 Tous les mod\u00e8les`,
    description: `${data.name} : tous les mod\u00e8les, fiches techniques, comparaisons et avis sur FLM AUTO.`,
    alternates: { canonical: `/marques/${slug}` },
  };
}

async function getBrandData(slug: string) {
  const db = createServerClient();

  const { data: brand } = await db
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!brand) return null;

  const { data: models } = await db
    .from("models")
    .select("id, name, slug, segment, body_styles, first_year, last_year, is_current")
    .eq("brand_id", brand.id)
    .order("name");

  const modelIds = models?.map((m) => m.id) || [];

  let generations: any[] = [];
  if (modelIds.length > 0) {
    const { data } = await db
      .from("generations")
      .select("id, model_id, name, slug, production_start, production_end")
      .in("model_id", modelIds);
    generations = data || [];
  }

  const genCountByModel = new Map<string, number>();
  for (const g of generations) {
    genCountByModel.set(g.model_id, (genCountByModel.get(g.model_id) || 0) + 1);
  }

  return {
    brand,
    models: (models || []).map((m) => ({
      ...m,
      generation_count: genCountByModel.get(m.id) || 0,
    })),
    totalGenerations: generations.length,
  };
}

export default async function BrandPage({ params }: Props) {
  const { brand: slug } = await params;
  const data = await getBrandData(slug);

  if (!data) notFound();

  const { brand, models, totalGenerations } = data;

  const current = models.filter((m) => m.is_current);
  const discontinued = models.filter((m) => !m.is_current);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: "Accueil", url: "/" },
              { name: "Marques", url: "/marques" },
              { name: brand.name },
            ])
          ),
        }}
      />
      <div className="mb-8">
        <Link
          href="/marques"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          &larr; Toutes les marques
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{brand.name}</h1>
        <p className="mt-1 text-muted-foreground">
          {models.length} mod&egrave;les &middot; {totalGenerations} g&eacute;n&eacute;rations
          {brand.country_origin && ` \u00b7 ${brand.country_origin}`}
          {brand.founded_year && ` \u00b7 Fond\u00e9 en ${brand.founded_year}`}
        </p>
      </div>

      {current.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-0.5 w-8 rounded-full bg-primary" />
            <h2 className="font-display text-xl font-semibold">Mod&egrave;les actuels ({current.length})</h2>
          </div>
          <ModelGrid models={current} brandSlug={slug} />
        </section>
      )}

      {discontinued.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-0.5 w-8 rounded-full bg-primary" />
            <h2 className="font-display text-xl font-semibold">Anciens mod&egrave;les ({discontinued.length})</h2>
          </div>
          <ModelGrid models={discontinued} brandSlug={slug} />
        </section>
      )}
    </div>
  );
}

function ModelGrid({
  models,
  brandSlug,
}: {
  models: any[];
  brandSlug: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {models.map((model) => (
        <Link
          key={model.id}
          href={`/marques/${brandSlug}/${model.slug}`}
        >
          <Card className="card-hover group h-full">
            <CardContent className="p-4">
              <h3 className="font-semibold text-white">{model.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {model.generation_count} g&eacute;n.
                </span>
                {model.segment && (
                  <Badge variant="outline" className="text-xs">
                    {model.segment}
                  </Badge>
                )}
                {model.first_year && (
                  <span className="text-xs text-muted-foreground">
                    {model.first_year}&ndash;{model.last_year || "..."}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
