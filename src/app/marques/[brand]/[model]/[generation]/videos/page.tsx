import { notFound } from "next/navigation";
import { createStaticClient } from "@/lib/supabase/server";
import { getGenerationBySlug, genLabel } from "@/lib/vehicle-helpers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { VehicleNav } from "@/components/vehicle-nav";
import { EmptyVideos } from "@/components/empty-states";
import { VideoPlayer } from "@/components/vehicle/video-player";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play } from "lucide-react";
import { ViewTracker } from "@/components/view-tracker";
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
    title: `Vid\u00e9os ${v.brand.name} ${v.model.name} ${label}`,
    description: `Vid\u00e9os et essais de la ${v.brand.name} ${v.model.name} ${label} : tests, pr\u00e9sentations, comparatifs.`,
    alternates: { canonical: `/marques/${bs}/${ms}/${gs}/videos` },
  };
}

type VideoCategory = "review" | "comparatif" | "sound" | "other";

function categorizeVideo(title: string): VideoCategory {
  const t = title.toLowerCase();
  if (t.includes("essai") || t.includes("review") || t.includes("test") || t.includes("pr\u00e9sentation")) return "review";
  if (t.includes("comparatif") || t.includes("vs") || t.includes("versus") || t.includes("compare")) return "comparatif";
  if (t.includes("sound") || t.includes("exhaust") || t.includes("son") || t.includes("launch")) return "sound";
  return "other";
}

const CATEGORY_LABELS: Record<VideoCategory, string> = {
  review: "Essais",
  comparatif: "Comparatifs",
  sound: "Son & Performance",
  other: "Autres",
};

async function getVideos(generationId: string) {
  const db = createStaticClient();
  const { data } = await db
    .from("vehicle_videos")
    .select("id, video_id, title, channel_name, published_at, duration_seconds, view_count, confidence")
    .eq("generation_id", generationId)
    .neq("confidence", "E")
    .order("view_count", { ascending: false })
    .limit(30);
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

  // Categorize
  const categorized = videos.map((video) => ({
    ...video,
    category: categorizeVideo(video.title || ""),
  }));

  const featured = categorized[0] || null;
  const remaining = categorized.slice(1);

  // Counts for display
  const categoryCounts: Record<string, number> = {};
  for (const v of categorized) {
    categoryCounts[v.category] = (categoryCounts[v.category] || 0) + 1;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <ViewTracker statKey="videosWatched" />
      <Breadcrumbs
        items={[
          { label: "Marques", href: "/marques" },
          { label: v.brand.name, href: `/marques/${bs}` },
          { label: v.model.name, href: `/marques/${bs}/${ms}` },
          { label: label, href: basePath },
          { label: "Vid\u00e9os" },
        ]}
      />

      <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
        Vid&eacute;os <span className="text-primary">{v.brand.name} {v.model.name}</span> {label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        <span className="text-mono font-semibold text-white">{videos.length}</span> vid&eacute;os YouTube : essais, pr&eacute;sentations, comparatifs.
      </p>

      <div className="mt-6">
        <VehicleNav basePath={basePath} active="videos" />
      </div>

      {/* Category Badges */}
      {videos.length > 0 && Object.keys(categoryCounts).length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.entries(CATEGORY_LABELS) as [VideoCategory, string][]).map(([cat, lbl]) => {
            const count = categoryCounts[cat] || 0;
            if (count === 0) return null;
            return (
              <Badge key={cat} variant="secondary" className="text-sm">
                {lbl} ({count})
              </Badge>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        {videos.length > 0 ? (
          <div className="space-y-8">
            {/* Featured Video — inline player */}
            {featured && (
              <VideoPlayer
                youtubeId={featured.video_id}
                title={featured.title}
                channelName={featured.channel_name}
                viewCount={featured.view_count}
              />
            )}

            {/* Remaining Videos Grid */}
            {remaining.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {remaining.map((video) => (
                  <a
                    key={video.id}
                    href={`https://www.youtube.com/watch?v=${video.video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Card className="card-hover group overflow-hidden">
                      <div className="relative aspect-video surface-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://i.ytimg.com/vi/${video.video_id}/mqdefault.jpg`}
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
                        <Badge
                          variant="secondary"
                          className="absolute left-2 top-2 text-xs"
                        >
                          {CATEGORY_LABELS[video.category]}
                        </Badge>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="line-clamp-2 text-sm font-medium leading-tight text-white">
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
            )}
          </div>
        ) : (
          <EmptyVideos />
        )}
      </div>
    </div>
  );
}
