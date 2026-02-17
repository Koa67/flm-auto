"use client";

import { useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface VehicleSpecs {
  id: string;
  label: string;
  power_hp: number | null;
  torque_nm: number | null;
  acceleration_0_100: number | null;
  top_speed_kmh: number | null;
  trunk_liters: number | null;
  safety_rating: number | null;
  consumption_l100?: number | null;
  tuv_defect_rate?: number | null;
}

interface CompareRadarProps {
  vehicles: VehicleSpecs[];
}

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#eab308"];

const AXES = [
  { key: "power", label: "Puissance" },
  { key: "torque", label: "Couple" },
  { key: "accel", label: "0-100" },
  { key: "speed", label: "V.max" },
  { key: "trunk", label: "Coffre" },
  { key: "safety", label: "S\u00e9curit\u00e9" },
  { key: "conso", label: "Conso" },
  { key: "fiab", label: "Fiabilit\u00e9" },
];

export function CompareRadar({ vehicles }: CompareRadarProps) {
  const data = useMemo(() => {
    // Compute max values for normalization
    const maxPower = Math.max(...vehicles.map((v) => v.power_hp || 0));
    const maxTorque = Math.max(...vehicles.map((v) => v.torque_nm || 0));
    const minAccel = Math.min(
      ...vehicles.filter((v) => v.acceleration_0_100).map((v) => v.acceleration_0_100!)
    );
    const maxSpeed = Math.max(...vehicles.map((v) => v.top_speed_kmh || 0));
    const maxTrunk = Math.max(...vehicles.map((v) => v.trunk_liters || 0));
    const maxSafety = Math.max(...vehicles.map((v) => v.safety_rating || 0));
    const minConso = Math.min(
      ...vehicles.filter((v) => v.consumption_l100).map((v) => v.consumption_l100!)
    );
    const minTuv = Math.min(
      ...vehicles.filter((v) => v.tuv_defect_rate).map((v) => v.tuv_defect_rate!)
    );

    const normalize = (val: number | null, max: number) => {
      if (!val || !max) return 0;
      return Math.round((val / max) * 100);
    };

    const normalizeInverted = (val: number | null, min: number) => {
      if (!val || !min) return 0;
      return Math.round((min / val) * 100);
    };

    return AXES.map((axis) => {
      const entry: Record<string, string | number> = { attr: axis.label };
      for (const v of vehicles) {
        switch (axis.key) {
          case "power":
            entry[v.id] = normalize(v.power_hp, maxPower);
            break;
          case "torque":
            entry[v.id] = normalize(v.torque_nm, maxTorque);
            break;
          case "accel":
            entry[v.id] = normalizeInverted(v.acceleration_0_100, minAccel);
            break;
          case "speed":
            entry[v.id] = normalize(v.top_speed_kmh, maxSpeed);
            break;
          case "trunk":
            entry[v.id] = normalize(v.trunk_liters, maxTrunk);
            break;
          case "safety":
            entry[v.id] = normalize(v.safety_rating, maxSafety);
            break;
          case "conso":
            entry[v.id] = normalizeInverted(v.consumption_l100 ?? null, minConso);
            break;
          case "fiab":
            entry[v.id] = normalizeInverted(v.tuv_defect_rate ?? null, minTuv);
            break;
        }
      }
      return entry;
    });
  }, [vehicles]);

  // Only show if we have meaningful data
  const hasData = vehicles.some(
    (v) => v.power_hp || v.torque_nm || v.acceleration_0_100
  );
  if (!hasData) return null;

  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="mb-4 text-center text-lg font-semibold">
        Radar de comparaison
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="65%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="attr"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            {vehicles.map((v, i) => (
              <Radar
                key={v.id}
                name={v.label}
                dataKey={v.id}
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value) => [`${value}/100`, ""]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
