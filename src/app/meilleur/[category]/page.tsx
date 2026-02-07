import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Star, Baby, Gauge } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 86400; // 24h

interface CategoryDef {
  slug: string;
  title: string;
  h1: string;
  description: string;
  query: (db: ReturnType<typeof createServerClient>) => Promise<any[]>;
}

const CATEGORIES: CategoryDef[] = [
  {
    slug: "suv-familial-2024",
    title: "Meilleur SUV familial 2024",
    h1: "Les meilleurs SUV familiaux en 2024",
    description:
      "Classement des meilleurs SUV familiaux basé sur notre score Family Fit, la sécurité Euro NCAP et l'espace intérieur.",
    query: async (db) => {
      const { data } = await db
        .from("family_fit_compatibility")
        .select("generation_id, family_fit_score, isofix_points, three_across_possible")
        .gte("family_fit_score", 50)
        .order("family_fit_score", { ascending: false })
        .limit(20);
      return data || [];
    },
  },
  {
    slug: "berline-sportive-2024",
    title: "Meilleure berline sportive 2024",
    h1: "Les meilleures berlines sportives en 2024",
    description:
      "Top des berlines sportives : puissance, performances, tenue de route. Classement par puissance.",
    query: async (db) => {
      const { data } = await db
        .from("engine_variants")
        .select("generation_id, power_hp:powertrain_specs(power_hp)")
        .gte("powertrain_specs.power_hp", 300)
        .order("powertrain_specs(power_hp)", { ascending: false })
        .limit(20);
      return data || [];
    },
  },
  {
    slug: "voiture-5-etoiles-euroncap-2024",
    title: "Voitures 5 étoiles Euro NCAP 2024",
    h1: "Toutes les voitures 5 étoiles Euro NCAP",
    description:
      "Liste complète des véhicules ayant obtenu la note maximale de 5 étoiles aux crash-tests Euro NCAP.",
    query: async (db) => {
      const { data } = await db
        .from("safety_ratings")
        .select("generation_id, stars, adult_occupant_pct, child_occupant_pct, test_year")
        .eq("stars", 5)
        .order("test_year", { ascending: false })
        .limit(30);
      return data || [];
    },
  },
  {
    slug: "suv-compact-2024",
    title: "Meilleur SUV compact 2024",
    h1: "Les meilleurs SUV compacts en 2024",
    description:
      "Classement des meilleurs SUV compacts : dimensions contenues, polyvalence maximale.",
    query: async (db) => {
      const { data } = await db
        .from("family_fit_compatibility")
        .select("generation_id, family_fit_score")
        .gte("family_fit_score", 40)
        .order("family_fit_score", { ascending: false })
        .limit(20);
      return data || [];
    },
  },
  {
    slug: "voiture-3-sieges-auto-2024",
    title: "Meilleures voitures pour 3 sièges auto 2024",
    h1: "Les meilleures voitures pour 3 sièges auto",
    description:
      "Quelles voitures permettent d'installer 3 sièges auto côte à côte ? Notre classement basé sur la largeur de banquette et la compatibilité ISOFIX.",
    query: async (db) => {
      const { data } = await db
        .from("family_fit_compatibility")
        .select("generation_id, family_fit_score, three_across_possible, isofix_points, rear_bench_width_usable_mm")
        .eq("three_across_possible", true)
        .order("family_fit_score", { ascending: false })
        .limit(20);
      return data || [];
    },
  },
];

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = CATEGORIES.find((c) => c.slug === category);
  if (!cat) return {};
  return {
    title: cat.title,
    description: cat.description,
    alternates: { canonical: `/meilleur/${category}` },
  };
}

async function enrichGenerations(genIds: string[]) {
  if (genIds.length === 0) return new Map();
  const db = createServerClient();

  const { data: gens } = await db
    .from("generations")
    .select(
      "id, name, slug, internal_code, production_start, production_end, model:models!inner(name, slug, brand:brands!inner(name, slug))"
    )
    .in("id", genIds);

  const { data: images } = await db
    .from("vehicle_images")
    .select("generation_id, image_url")
    .in("generation_id", genIds)
    .eq("image_type", "exterior")
    .limit(100);

  const imageMap = new Map<string, string>();
  if (images) {
    for (const img of images) {
      if (!imageMap.has(img.generation_id)) {
        imageMap.set(img.generation_id, img.image_url);
      }
    }
  }

  const map = new Map<string, any>();
  for (const g of gens || []) {
    const model = g.model as any;
    map.set(g.id, {
      name: `${model.brand.name} ${model.name}`,
      gen: g.internal_code || g.name,
      slug: `/marques/${model.brand.slug}/${model.slug}/${g.slug}`,
      image: imageMap.get(g.id) || null,
      yearStart: g.production_start
        ? new Date(g.production_start).getFullYear()
        : null,
    });
  }
  return map;
}

export default async function MeilleurPage({ params }: Props) {
  const { category } = await params;
  const cat = CATEGORIES.find((c) => c.slug === category);
  if (!cat) notFound();

  const db = createServerClient();
  const results = await cat.query(db);

  const genIds = [...new Set(results.map((r: any) => r.generation_id))];
  const genMap = await enrichGenerations(genIds);

  const ranked = results
    .map((r: any, i: number) => ({
      rank: i + 1,
      ...r,
      vehicle: genMap.get(r.generation_id),
    }))
    .filter((r: any) => r.vehicle);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Classements", href: "/meilleur/suv-familial-2024" },
          { label: cat.title },
        ]}
      />

      <h1 className="mt-4 text-3xl font-bold">{cat.h1}</h1>
      <p className="mt-2 text-muted-foreground">{cat.description}</p>

      <div className="mt-8 space-y-4">
        {ranked.map((item: any) => (
          <Link key={item.generation_id} href={item.vehicle.slug}>
            <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {item.rank}
                </div>
                {item.vehicle.image && (
                  <div className="relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted sm:block">
                    <Image
                      src={item.vehicle.image}
                      alt={item.vehicle.name}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{item.vehicle.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{item.vehicle.gen}</span>
                    {item.family_fit_score && (
                      <Badge variant="secondary">
                        Score: {item.family_fit_score}/100
                      </Badge>
                    )}
                    {item.stars && (
                      <Badge variant="secondary">{item.stars}★ NCAP</Badge>
                    )}
                    {item.three_across_possible && (
                      <Badge variant="outline">3-across</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {ranked.length === 0 && (
          <p className="text-muted-foreground">
            Aucun véhicule ne correspond à cette catégorie.
          </p>
        )}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: cat.title,
            itemListElement: ranked.slice(0, 10).map((item: any, i: number) => ({
              "@type": "ListItem",
              position: i + 1,
              name: `${item.vehicle.name} ${item.vehicle.gen}`,
              url: `https://flm-auto.vercel.app${item.vehicle.slug}`,
            })),
          }),
        }}
      />
    </div>
  );
}
