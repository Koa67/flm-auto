import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createStaticClient } from "@/lib/supabase/server";
import { RANKING_CATEGORIES } from "@/lib/rankings/categories";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";
import { generateFAQSchema } from "@/lib/schema/faq-schema";
import { RelatedLinks } from "@/components/seo/related-links";

export const revalidate = 86400; // 24h

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return RANKING_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = RANKING_CATEGORIES.find((c) => c.slug === category);
  if (!cat) return {};
  const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://flm-auto.fr";
  const ogUrl = `${BASE}/api/og?title=${encodeURIComponent(cat.title)}&subtitle=${encodeURIComponent("Classement FLM AUTO")}&stats=${encodeURIComponent(cat.group)}`;
  return {
    title: cat.title,
    description: cat.description,
    alternates: { canonical: `/meilleur/${category}` },
    openGraph: {
      title: `${cat.title} | FLM Auto`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
  };
}

async function enrichGenerations(genIds: string[]) {
  if (genIds.length === 0) return new Map<string, any>();
  const db = createStaticClient();

  const { data: gens } = await db
    .from("generations")
    .select(
      "id, name, slug, internal_code, production_start, production_end, model:models!inner(name, slug, brand:brands!inner(name, slug))"
    )
    .in("id", genIds);

  const { data: images } = await db
    .from("vehicle_images")
    .select("generation_id, url")
    .in("generation_id", genIds)
    .neq("confidence", "E")
    .eq("image_type", "exterior")
    .limit(genIds.length);

  const imageMap = new Map<string, string>();
  if (images) {
    for (const img of images) {
      if (!imageMap.has(img.generation_id)) {
        imageMap.set(img.generation_id, img.url);
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

function editorialIntro(group: string, topNames: string[]): string {
  const year = new Date().getFullYear();
  const top = topNames.length > 0 ? topNames.join(", ") : "";
  const intros: Record<string, string> = {
    famille: `Le marché automobile ${year} offre un large choix pour les familles. ${top ? `En tête de notre classement : ${top}.` : ""} Score basé sur les points ISOFIX, la largeur de banquette et la sécurité Euro NCAP.`,
    securite: `La sécurité automobile progresse chaque année grâce aux crash-tests Euro NCAP. ${top ? `Les mieux notés : ${top}.` : ""} Seules les données vérifiées (confiance A/B) sont prises en compte.`,
    performance: `Pour les amateurs de sensations fortes, voici les modèles les plus performants en ${year}. ${top ? `Le podium : ${top}.` : ""} Données issues des fiches techniques constructeur.`,
    coffre: `Le volume de coffre est un critère décisif pour les familles et les voyageurs. ${top ? `Les champions du chargement : ${top}.` : ""} Volumes mesurés en litres selon la norme VDA.`,
    segment: `Découvrez les meilleurs modèles par catégorie de carrosserie en ${year}. ${top ? `En vedette : ${top}.` : ""}`,
    divers: `Classement spécial mis à jour pour ${year}. ${top ? `En haut du tableau : ${top}.` : ""} Données vérifiées issues de notre base de 13 000+ variantes.`,
  };
  return intros[group] || intros.divers;
}

export default async function MeilleurPage({ params }: Props) {
  const { category } = await params;
  const cat = RANKING_CATEGORIES.find((c) => c.slug === category);
  if (!cat) notFound();

  const db = createStaticClient();
  const results = await cat.query(db);

  const genIds = [...new Set(results.map((r: any) => r.generation_id))];
  const genMap = await enrichGenerations(genIds);

  const ranked = results
    .filter(
      (r: any, i: number, arr: any[]) =>
        arr.findIndex((x: any) => x.generation_id === r.generation_id) === i
    )
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
          { label: "Classements", href: "/meilleur" },
          { label: cat.title },
        ]}
      />

      <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{cat.h1}</h1>
      <p className="mt-2 text-muted-foreground">{cat.description}</p>
      <p className="mt-2 text-sm text-muted-foreground/70">{editorialIntro(cat.group, ranked.slice(0, 3).map((v: any) => `${v.vehicle.name} ${v.vehicle.gen}`))}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="text-mono font-semibold text-white">{ranked.length}</span> véhicule{ranked.length !== 1 ? "s" : ""} classé
        {ranked.length !== 1 ? "s" : ""}
      </p>

      <div className="mt-8 space-y-4">
        {ranked.map((item: any) => (
          <Link key={item.generation_id} href={item.vehicle.slug}>
            <Card className={`card-hover group ${item.rank === 1 ? "podium-1" : item.rank === 2 ? "podium-2" : item.rank === 3 ? "podium-3" : ""}`}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-mono text-lg font-bold ${item.rank <= 3 ? "bg-primary text-primary-foreground" : "surface-3 border border-[var(--border-subtle)] text-muted-foreground"}`}>
                  {item.rank}
                </div>
                {item.vehicle.image && (
                  <div className="relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-md surface-2 sm:block">
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
                  <h2 className="font-semibold text-white">{item.vehicle.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{item.vehicle.gen}</span>
                    {item.vehicle.yearStart && (
                      <span>({item.vehicle.yearStart})</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {item.stars != null && (
                      <Badge variant="secondary">{item.stars}★ NCAP</Badge>
                    )}
                    {item.family_fit_score != null && (
                      <Badge variant="secondary">
                        Score: {item.family_fit_score}/100
                      </Badge>
                    )}
                    {item.three_across_possible && (
                      <Badge variant="outline">3-across</Badge>
                    )}
                    {item.isofix_points != null && (
                      <Badge variant="outline">
                        {item.isofix_points} ISOFIX
                      </Badge>
                    )}
                    {item.power_hp != null && (
                      <Badge variant="secondary">{item.power_hp} ch</Badge>
                    )}
                    {item.acceleration != null && (
                      <Badge variant="secondary">{item.acceleration}s</Badge>
                    )}
                    {item.torque_nm != null && (
                      <Badge variant="secondary">{item.torque_nm} Nm</Badge>
                    )}
                    {item.top_speed != null && (
                      <Badge variant="secondary">{item.top_speed} km/h</Badge>
                    )}
                    {item.trunk_volume_liters != null && (
                      <Badge variant="secondary">
                        {item.trunk_volume_liters} L
                      </Badge>
                    )}
                    {item.trunk_volume_max_liters != null && (
                      <Badge variant="outline">
                        max {item.trunk_volume_max_liters} L
                      </Badge>
                    )}
                    {item.seating_capacity != null &&
                      item.seating_capacity >= 6 && (
                        <Badge variant="outline">
                          {item.seating_capacity} places
                        </Badge>
                      )}
                    {item.child_occupant_pct != null && (
                      <Badge variant="secondary">
                        Enfants: {item.child_occupant_pct}%
                      </Badge>
                    )}
                    {item.safety_assist_pct != null && (
                      <Badge variant="secondary">
                        Aide: {item.safety_assist_pct}%
                      </Badge>
                    )}
                    {item.pedestrian_pct != null && (
                      <Badge variant="secondary">
                        Piétons: {item.pedestrian_pct}%
                      </Badge>
                    )}
                    {item.adult_occupant_pct != null && (
                      <Badge variant="secondary">
                        Adultes: {item.adult_occupant_pct}%
                      </Badge>
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

      {/* Related links for internal linking */}
      <RelatedLinks
        title="Autres classements"
        links={[
          ...RANKING_CATEGORIES.filter((c) => c.group === cat.group && c.slug !== cat.slug),
          ...RANKING_CATEGORIES.filter((c) => c.group !== cat.group).slice(0, 4),
        ]
          .slice(0, 10)
          .map((c) => ({ label: c.title, href: `/meilleur/${c.slug}` }))}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: cat.title,
            description: cat.description,
            numberOfItems: ranked.length,
            itemListElement: ranked.slice(0, 30).map((item: any, i: number) => ({
              "@type": "ListItem",
              position: i + 1,
              name: `${item.vehicle.name} ${item.vehicle.gen}`,
              url: `https://flm-auto.fr${item.vehicle.slug}`,
            })),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateFAQSchema(
              cat.title,
              cat.description,
              cat.group,
              ranked[0] ? `${ranked[0].vehicle.name} ${ranked[0].vehicle.gen}` : undefined
            )
          ),
        }}
      />
    </div>
  );
}
