import { notFound } from "next/navigation";
import { createStaticClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BrowseGrid, type BrowseVehicle } from "@/components/explorer/browse-grid";
import { BUDGET_CATEGORIES, BUDGET_FILTERS } from "@/lib/explorer-config";
import type { Metadata } from "next";

export const revalidate = 86400;

interface Props {
  params: Promise<{ range: string }>;
}

export async function generateStaticParams() {
  return BUDGET_CATEGORIES.map((c) => ({ range: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { range } = await params;
  const cat = BUDGET_CATEGORIES.find((c) => c.slug === range);
  if (!cat) return {};
  return {
    title: `${cat.label} — Explorer par budget | FLM AUTO`,
    description: `Véhicules ${cat.label.toLowerCase()} : ${cat.description}. Photos, fiches techniques et comparatifs.`,
    alternates: { canonical: `/explorer/budget/${range}` },
    openGraph: {
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(cat.label)}&subtitle=Explorer%20par%20budget`,
        },
      ],
    },
  };
}

export default async function BudgetBrowsePage({ params }: Props) {
  const { range } = await params;
  const cat = BUDGET_CATEGORIES.find((c) => c.slug === range);
  const filters = BUDGET_FILTERS[range];
  if (!cat || !filters) notFound();

  const db = createStaticClient();
  let query = db
    .from("vehicle_search_index")
    .select("*");

  if (filters.power_min != null) {
    query = query.gte("power_hp", filters.power_min);
  }
  if (filters.power_max != null) {
    query = query.lte("power_hp", filters.power_max);
  }

  query = query
    .order("power_hp", { ascending: true, nullsFirst: false })
    .limit(200);

  const { data } = await query;
  const vehicles: BrowseVehicle[] = data || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Explorer", href: "/explorer" },
          { label: "Budget", href: "/explorer" },
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
