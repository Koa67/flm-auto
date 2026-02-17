"use client";

import { useState } from "react";
import { Play } from "lucide-react";

interface VideoPlayerProps {
  youtubeId: string;
  title?: string;
  channelName?: string;
  viewCount?: number | null;
  className?: string;
}

export function VideoPlayer({
  youtubeId,
  title,
  channelName,
  viewCount,
  className,
}: VideoPlayerProps) {
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    return (
      <div className={className}>
        <button
          onClick={() => setLoaded(true)}
          className="group relative w-full overflow-hidden rounded-2xl"
        >
          <div className="relative aspect-video bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`}
              alt={title || ""}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
              <div className="rounded-full bg-red-600 p-4 shadow-lg transition-transform group-hover:scale-110">
                <Play className="h-8 w-8 text-white" fill="white" />
              </div>
            </div>
          </div>
        </button>
        {title && (
          <div className="mt-3">
            <h3 className="line-clamp-2 font-semibold">{title}</h3>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {channelName && <span>{channelName}</span>}
              {viewCount != null && viewCount > 0 && (
                <>
                  <span>{"\u00b7"}</span>
                  <span>{formatViews(viewCount)}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-2xl">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {title && (
        <div className="mt-3">
          <h3 className="line-clamp-2 font-semibold">{title}</h3>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {channelName && <span>{channelName}</span>}
            {viewCount != null && viewCount > 0 && (
              <>
                <span>{"\u00b7"}</span>
                <span>{formatViews(viewCount)}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatViews(count: number) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M vues`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}k vues`;
  return `${count} vues`;
}
