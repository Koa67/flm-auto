import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { getGenerationBySlug, genLabel } from "@/lib/vehicle-helpers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { VehicleNav } from "@/components/vehicle-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play } from "lucide-react";
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
    title: `Vidéos ${v.brand.name} ${v.model.name} ${label}`,
    description: `Vidéos et essais de la ${v.brand.name} ${v.model.name} ${label} : tests, présentations, comparatifs.`,
    alternates: { canonical: `/marques/${bs}/${ms}/${gs}/videos` },
  };
}

async function getVideos(generationId: string) {
  const db = createServerClient();
  const { data } = await db
    .from("vehicle_videos")
    .select("id, youtube_id, title, channel_name, published_at, duration_seconds, view_count")
    .eq("generation_id", generationId)
    .order("view_count", { ascending: false })
    .limit(24);
  return data || [];
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatViews(count: number | null) {
  if (!count) return "";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M vues`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}k vues`;
  return `${count} vues`;
}

export default async function VideosPage({ params }: Props) {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) notFound();

  const videos = await getVideos(v.generation.id);
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
          { label: "Vidéos" },
        ]}
      />

      <h1 className="mt-4 text-3xl font-bold">
        Vidéos {v.brand.name} {v.model.name} {label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {videos.length} vidéos YouTube : essais, présentations, comparatifs.
      </p>

      <div className="mt-6">
        <VehicleNav basePath={basePath} active="videos" />
      </div>

      <div className="mt-8">
        {videos.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <a
                key={video.id}
                href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Card className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
                  <div className="relative aspect-video bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://i.ytimg.com/vi/${video.youtube_id}/mqdefault.jpg`}
                      alt={video.title || ""}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30">
                      <div className="rounded-full bg-red-600 p-3">
                        <Play className="h-6 w-6 text-white" fill="white" />
                      </div>
                    </div>
                    {video.duration_seconds && (
                      <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
                        {formatDuration(video.duration_seconds)}
                      </span>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="line-clamp-2 text-sm font-medium leading-tight">
                      {video.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {video.channel_name && (
                        <span>{video.channel_name}</span>
                      )}
                      {video.view_count && (
                        <Badge variant="secondary" className="text-xs">
                          {formatViews(video.view_count)}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            Aucune vidéo disponible pour ce véhicule.
          </p>
        )}
      </div>
    </div>
  );
}
