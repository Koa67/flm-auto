import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { getGenerationBySlug, genLabel } from "@/lib/vehicle-helpers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { VehicleNav } from "@/components/vehicle-nav";
import { EmptyPhotos } from "@/components/empty-states";
import { GalleryPro } from "@/components/vehicle/gallery-pro";
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
    title: `Photos ${v.brand.name} ${v.model.name} ${label}`,
    description: `Galerie photos de la ${v.brand.name} ${v.model.name} ${label} : extérieur, intérieur, détails techniques.`,
    alternates: { canonical: `/marques/${bs}/${ms}/${gs}/photos` },
  };
}

async function getImages(generationId: string) {
  const db = createServerClient();
  const { data } = await db
    .from("vehicle_images")
    .select("id, url, image_type, source, alt_text, confidence, width")
    .eq("generation_id", generationId)
    .neq("confidence", "E")
    .limit(100);

  // Sort by quality: confidence tier + type priority + width
  const CONF: Record<string, number> = { A: 10, B: 8, C: 6, D: 4, E: 2 };
  const TYPE: Record<string, number> = { exterior: 6, interior: 4, blueprint: 3, technical: 3, cutaway: 3, diagram: 2 };
  return (data || []).sort((a, b) => {
    const sa = (CONF[a.confidence] || 2) + (TYPE[a.image_type] || 1) + Math.min((a.width || 0) / 200, 5);
    const sb = (CONF[b.confidence] || 2) + (TYPE[b.image_type] || 1) + Math.min((b.width || 0) / 200, 5);
    return sb - sa;
  });
}

export default async function PhotosPage({ params }: Props) {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) notFound();

  const images = await getImages(v.generation.id);
  const label = genLabel(v.generation);
  const basePath = `/marques/${bs}/${ms}/${gs}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Marques", href: "/marques" },
          { label: v.brand.name, href: `/marques/${bs}` },
          { label: v.model.name, href: `/marques/${bs}/${ms}` },
          { label: label, href: basePath },
          { label: "Photos" },
        ]}
      />

      <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
        Photos <span className="text-primary">{v.brand.name} {v.model.name}</span> {label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        <span className="text-mono font-semibold text-white">{images.length}</span> photos haute qualité.
      </p>

      <div className="mt-6">
        <VehicleNav basePath={basePath} active="photos" />
      </div>

      <div className="mt-8">
        {images.length > 0 ? (
          <GalleryPro
            images={images}
            vehicleName={`${v.brand.name} ${v.model.name} ${label}`}
          />
        ) : (
          <EmptyPhotos />
        )}
      </div>
    </div>
  );
}
