import { notFound } from "next/navigation";
import { createStaticClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BrowseGrid, type BrowseVehicle } from "@/components/explorer/browse-grid";
import { DECADE_CATEGORIES, DECADE_FILTERS } from "@/lib/explorer-config";
import type { Metadata } from "next";

export const revalidate = 86400;

interface Props {
  params: Promise<{ decade: string }>;
}

export async function generateStaticParams() {
  return DECADE_CATEGORIES.map((c) => ({ decade: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { decade } = await params;
  const cat = DECADE_CATEGORIES.find((c) => c.slug === decade);
  if (!cat) return {};
  return {
    title: `${cat.label} — Explorer par décennie | FLM AUTO`,
    description: `Véhicules des ${cat.label.toLowerCase()} : ${cat.description}. Photos, fiches techniques et comparatifs.`,
    alternates: { canonical: `/explorer/decennie/${decade}` },
    openGraph: {
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(cat.label)}&subtitle=Explorer%20par%20d%C3%A9cennie`,
        },
      ],
    },
  };
}

export default async function DecadeBrowsePage({ params }: Props) {
  const { decade } = await params;
  const cat = DECADE_CATEGORIES.find((c) => c.slug === decade);
  const filters = DECADE_FILTERS[decade];
  if (!cat || !filters) notFound();

  const db = createStaticClient();
  const { data } = await db
    .from("vehicle_search_index")
    .select("*")
    .gte("year_start", filters.year_min)
    .lte("year_start", filters.year_max)
    .order("year_start", { ascending: false, nullsFirst: false })
    .order("brand_name", { ascending: true })
    .limit(200);

  const vehicles: BrowseVehicle[] = data || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Explorer", href: "/explorer" },
          { label: "Décennie", href: "/explorer" },
          { label: cat.label },
        ]}
      />

      <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
        {cat.label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {cat.description} — {vehicles.length} véhicule
        {vehicles.length !== 1 ? "s" : ""}
      </p>

      <div className="mt-8">
        <BrowseGrid vehicles={vehicles} />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `${cat.label} — FLM AUTO`,
            numberOfItems: vehicles.length,
            itemListElement: vehicles.slice(0, 20).map((v, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: `${v.brand_name} ${v.model_name} ${v.internal_code || v.generation_name}`,
              url: `https://flm-auto.vercel.app/marques/${v.brand_slug}/${v.model_slug}/${v.generation_slug}`,
            })),
          }),
        }}
      />
    </div>
  );
}
