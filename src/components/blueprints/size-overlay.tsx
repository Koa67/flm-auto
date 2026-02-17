"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface VehicleDims {
  id: string;
  label: string;
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  color: string;
}

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#eab308"];

interface SizeOverlayProps {
  vehicles: {
    id: string;
    label: string;
    length_mm: number | null;
    width_mm: number | null;
    height_mm: number | null;
    wheelbase_mm: number | null;
  }[];
  className?: string;
}

export function SizeOverlay({ vehicles, className }: SizeOverlayProps) {
  const valid = vehicles
    .filter((v) => v.length_mm && v.height_mm)
    .map((v, i) => ({
      id: v.id,
      label: v.label,
      length: v.length_mm!,
      width: v.width_mm || 0,
      height: v.height_mm!,
      wheelbase: v.wheelbase_mm || v.length_mm! * 0.6,
      color: COLORS[i % COLORS.length],
    }));

  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(valid.map((v) => [v.id, true]))
  );
  const [opacity, setOpacity] = useState(0.6);

  if (valid.length < 2) return null;

  const maxLength = Math.max(...valid.map((v) => v.length));
  const maxHeight = Math.max(...valid.map((v) => v.height));

  const svgW = 700;
  const svgH = 300;
  const pad = 40;
  const drawW = svgW - pad * 2;
  const drawH = svgH - pad * 2;

  const scale = Math.min(drawW / maxLength, drawH / maxHeight);

  function toggle(id: string) {
    setVisible((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Comparaison des gabarits</h3>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
          <rect width={svgW} height={svgH} fill="#18181b" rx="8" />
          {/* Ground line */}
          <line
            x1={pad}
            y1={svgH - pad}
            x2={svgW - pad}
            y2={svgH - pad}
            stroke="#3f3f46"
            strokeWidth="1"
            strokeDasharray="4,4"
          />

          {valid.map((v) => {
            if (!visible[v.id]) return null;
            const w = v.length * scale;
            const h = v.height * scale;
            const wb = v.wheelbase * scale;
            const x = pad;
            const y = svgH - pad - h;

            const roofH = h * 0.45;
            const hoodLen = (w - wb) * 0.5;
            const trunkLen = (w - wb) * 0.5;

            return (
              <g key={v.id} opacity={opacity}>
                {/* Simple side silhouette */}
                <path
                  d={`
                    M ${x} ${y + h}
                    L ${x} ${y + h - h * 0.15}
                    Q ${x + hoodLen * 0.3} ${y + h - h * 0.2} ${x + hoodLen} ${y + h - h * 0.35}
                    L ${x + hoodLen + w * 0.05} ${y + roofH}
                    Q ${x + hoodLen + w * 0.1} ${y} ${x + hoodLen + w * 0.25} ${y}
                    L ${x + w - trunkLen - w * 0.1} ${y}
                    Q ${x + w - trunkLen} ${y} ${x + w - trunkLen} ${y + roofH * 0.7}
                    L ${x + w} ${y + h - h * 0.2}
                    L ${x + w} ${y + h}
                    Z
                  `}
                  fill={v.color}
                  fillOpacity={0.3}
                  stroke={v.color}
                  strokeWidth="2"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend + controls */}
      <div className="border-t px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          {valid.map((v) => (
            <button
              key={v.id}
              onClick={() => toggle(v.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium transition-opacity",
                visible[v.id] ? "opacity-100" : "opacity-40"
              )}
            >
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: v.color }}
              />
              {v.label}
              <span className="text-muted-foreground">
                {v.length} mm
              </span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Opacité</span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.1}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="h-1 w-32 accent-primary"
          />
        </div>
      </div>
    </div>
  );
}
