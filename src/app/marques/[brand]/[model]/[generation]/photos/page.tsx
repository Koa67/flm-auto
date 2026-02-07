import Image from "next/image";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { getGenerationBySlug, genLabel } from "@/lib/vehicle-helpers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { VehicleNav } from "@/components/vehicle-nav";
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
    .select("id, image_url, image_type, source_name, attribution")
    .eq("generation_id", generationId)
    .limit(50);
  return data || [];
}

export default async function PhotosPage({ params }: Props) {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) notFound();

  const images = await getImages(v.generation.id);
  const label = genLabel(v.generation);
  const basePath = `/marques/${bs}/${ms}/${gs}`;

  const exteriors = images.filter((i) => i.image_type === "exterior");
  const interiors = images.filter((i) => i.image_type === "interior");
  const others = images.filter(
    (i) => !["exterior", "interior"].includes(i.image_type)
  );

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

      <h1 className="mt-4 text-3xl font-bold">
        Photos {v.brand.name} {v.model.name} {label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {images.length} photos haute qualité.
      </p>

      <div className="mt-6">
        <VehicleNav basePath={basePath} active="photos" />
      </div>

      <div className="mt-8 space-y-10">
        {exteriors.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">
              Extérieur ({exteriors.length})
            </h2>
            <PhotoGrid images={exteriors} alt={`${v.brand.name} ${v.model.name} ${label}`} />
          </section>
        )}

        {interiors.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">
              Intérieur ({interiors.length})
            </h2>
            <PhotoGrid images={interiors} alt={`${v.brand.name} ${v.model.name} ${label} intérieur`} />
          </section>
        )}

        {others.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">
              Autres ({others.length})
            </h2>
            <PhotoGrid images={others} alt={`${v.brand.name} ${v.model.name} ${label}`} />
          </section>
        )}

        {images.length === 0 && (
          <p className="text-muted-foreground">
            Aucune photo disponible pour ce véhicule.
          </p>
        )}
      </div>
    </div>
  );
}

function PhotoGrid({
  images,
  alt,
}: {
  images: { id: string; image_url: string; source_name: string; attribution?: string }[];
  alt: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {images.map((img) => (
        <div key={img.id} className="group relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
            <Image
              src={img.image_url}
              alt={alt}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </div>
          {img.source_name && (
            <p className="mt-1 text-xs text-muted-foreground">
              {img.source_name}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
