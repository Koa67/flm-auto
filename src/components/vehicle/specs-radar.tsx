"use client";

import { useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface SpecsRadarProps {
  specs: {
    power_hp?: number | null;
    torque_nm?: number | null;
    acceleration_0_100?: number | null;
    trunk_volume?: number | null;
    safety_rating?: number | null;
    top_speed?: number | null;
  };
}

// Segment-wide approximate averages for normalization
const SEGMENT_AVERAGES = {
  power_hp: 180,
  torque_nm: 300,
  acceleration_0_100: 9,
  trunk_volume: 420,
  safety_rating: 4,
  top_speed: 210,
};

export function SpecsRadar({ specs }: SpecsRadarProps) {
  const data = useMemo(() => {
    const normalize = (
      value: number | null | undefined,
      avg: number,
      inverted = false
    ) => {
      if (!value) return 0;
      const ratio = value / avg;
      const score = inverted ? (2 - ratio) * 50 : ratio * 50;
      return Math.max(0, Math.min(100, Math.round(score)));
    };

    const items = [
      {
        attr: "Puissance",
        value: normalize(specs.power_hp, SEGMENT_AVERAGES.power_hp),
      },
      {
        attr: "Couple",
        value: normalize(specs.torque_nm, SEGMENT_AVERAGES.torque_nm),
      },
      {
        attr: "Consommation",
        value: normalize(
          specs.acceleration_0_100,
          SEGMENT_AVERAGES.acceleration_0_100,
          true
        ),
      },
      {
        attr: "Coffre",
        value: normalize(specs.trunk_volume, SEGMENT_AVERAGES.trunk_volume),
      },
      {
        attr: "Sécurité",
        value: (specs.safety_rating || 0) * 20,
      },
      {
        attr: "V.max",
        value: normalize(specs.top_speed, SEGMENT_AVERAGES.top_speed),
      },
    ];

    // Only return if we have at least 3 non-zero values
    const nonZero = items.filter((i) => i.value > 0);
    if (nonZero.length < 3) return null;
    return items;
  }, [specs]);

  if (!data) return null;

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h3 className="mb-4 text-center text-lg font-semibold">
        Profil du véhicule
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="attr"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <Radar
              name="Score"
              dataKey="value"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value) => [`${value}/100`, "Score"]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Comparé à la moyenne du segment
      </p>
    </div>
  );
}
