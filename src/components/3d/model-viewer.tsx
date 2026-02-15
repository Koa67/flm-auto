"use client";

import { useState } from "react";
import Image from "next/image";
import { Box, Maximize2, Minimize2, ExternalLink } from "lucide-react";

interface ModelViewerProps {
  embedUrl: string;
  thumbnailUrl?: string;
  title?: string;
  author?: string;
  license?: string;
  modelUrl?: string;
}

export function ModelViewer({
  embedUrl,
  thumbnailUrl,
  title,
  author,
  license,
  modelUrl,
}: ModelViewerProps) {
  const [loaded, setLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  if (!loaded) {
    return (
      <div className="relative overflow-hidden rounded-xl border bg-zinc-900">
        {thumbnailUrl ? (
          <div className="relative aspect-video">
            <Image
              src={thumbnailUrl}
              alt={title || "Modèle 3D"}
              fill
              className="object-cover opacity-60"
              sizes="(max-width: 768px) 100vw, 600px"
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center bg-zinc-900">
            <Box className="h-16 w-16 text-zinc-600" />
          </div>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <button
            onClick={() => setLoaded(true)}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105"
          >
            <Box className="mr-2 inline-block h-4 w-4" />
            Charger le modèle 3D
          </button>
          {title && (
            <span className="text-sm text-white/70">{title}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 bg-black"
          : "relative overflow-hidden rounded-xl border bg-zinc-900"
      }
    >
      <iframe
        src={`${embedUrl}?autospin=0.2&autostart=1&ui_theme=dark`}
        className="h-full w-full"
        style={{ aspectRatio: fullscreen ? undefined : "16/9" }}
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
      />

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
        <div className="text-sm text-white/80">
          {author && <span>par {author}</span>}
          {license && <span className="ml-2 text-xs text-white/50">({license})</span>}
        </div>
        <div className="flex items-center gap-2">
          {modelUrl && (
            <a
              href={modelUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ouvrir le modèle 3D"
              className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"}
            onClick={() => setFullscreen(!fullscreen)}
            className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
