"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { VehicleSilhouette } from "./vehicle-silhouette";
import { Download } from "lucide-react";

type View = "side" | "front" | "top";

interface BlueprintViewerProps {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  groundClearance?: number;
  label?: string;
  className?: string;
}

const views: { key: View; label: string }[] = [
  { key: "side", label: "Côté" },
  { key: "front", label: "Face" },
  { key: "top", label: "Dessus" },
];

export function BlueprintViewer({
  length,
  width,
  height,
  wheelbase,
  groundClearance,
  label,
  className,
}: BlueprintViewerProps) {
  const [active, setActive] = useState<View>("side");
  const svgRef = useRef<HTMLDivElement>(null);

  const downloadSvg = useCallback(() => {
    const svgEl = svgRef.current?.querySelector("svg");
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([clone.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blueprint-${active}-${label?.replace(/\s+/g, "-") || "vehicle"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [active, label]);

  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex gap-1">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setActive(v.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active === v.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button
          aria-label="Télécharger SVG"
          onClick={downloadSvg}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Télécharger SVG"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>

      {/* SVG view */}
      <div ref={svgRef} className="p-4">
        <VehicleSilhouette
          length={length}
          width={width}
          height={height}
          wheelbase={wheelbase}
          groundClearance={groundClearance}
          view={active}
          label={label}
        />
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 border-t px-4 py-3">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setActive(v.key)}
            className={cn(
              "flex-1 overflow-hidden rounded-lg border p-1 transition-colors",
              active === v.key
                ? "border-primary ring-1 ring-primary"
                : "border-transparent hover:border-muted-foreground/30"
            )}
          >
            <div className="pointer-events-none opacity-60 [&_text]:hidden">
              <VehicleSilhouette
                length={length}
                width={width}
                height={height}
                wheelbase={wheelbase}
                groundClearance={groundClearance}
                view={v.key}
              />
            </div>
            <span className="block text-center text-[10px] text-muted-foreground">
              {v.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
