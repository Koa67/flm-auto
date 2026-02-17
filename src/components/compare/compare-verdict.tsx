"use client";

/**
 * Deterministic verdict scoring /100 for vehicle comparisons.
 * 6 weighted categories, no LLM calls. Template-based verdict phrase.
 */

interface VehicleData {
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
  price_used?: number | null;
}

interface CompareVerdictProps {
  vehicles: VehicleData[];
}

// Category weights (sum = 100)
const WEIGHTS = {
  performance: 20,
  safety: 20,
  practicality: 15,
  efficiency: 15,
  reliability: 15,
  value: 15,
};

function scoreVehicle(v: VehicleData, all: VehicleData[]): { total: number; categories: Record<string, number> } {
  const categories: Record<string, number> = {};

  // Performance (power + acceleration + top speed)
  const maxPower = Math.max(...all.map((x) => x.power_hp || 0)) || 1;
  const bestAccel = Math.min(...all.filter((x) => x.acceleration_0_100).map((x) => x.acceleration_0_100!)) || 1;
  const maxSpeed = Math.max(...all.map((x) => x.top_speed_kmh || 0)) || 1;

  const perfPower = v.power_hp ? (v.power_hp / maxPower) * 100 : 50;
  const perfAccel = v.acceleration_0_100 ? (bestAccel / v.acceleration_0_100) * 100 : 50;
  const perfSpeed = v.top_speed_kmh ? (v.top_speed_kmh / maxSpeed) * 100 : 50;
  categories.performance = Math.round((perfPower * 0.4 + perfAccel * 0.35 + perfSpeed * 0.25));

  // Safety
  const maxSafety = Math.max(...all.map((x) => x.safety_rating || 0)) || 1;
  categories.safety = v.safety_rating ? Math.round((v.safety_rating / maxSafety) * 100) : 50;

  // Practicality (trunk volume)
  const maxTrunk = Math.max(...all.map((x) => x.trunk_liters || 0)) || 1;
  categories.practicality = v.trunk_liters ? Math.round((v.trunk_liters / maxTrunk) * 100) : 50;

  // Efficiency (lower consumption = better)
  const bestConso = Math.min(...all.filter((x) => x.consumption_l100).map((x) => x.consumption_l100!));
  categories.efficiency = v.consumption_l100 && bestConso
    ? Math.round((bestConso / v.consumption_l100) * 100)
    : 50;

  // Reliability (lower TÜV defect rate = better)
  const bestTuv = Math.min(...all.filter((x) => x.tuv_defect_rate).map((x) => x.tuv_defect_rate!));
  categories.reliability = v.tuv_defect_rate && bestTuv
    ? Math.round((bestTuv / v.tuv_defect_rate) * 100)
    : 50;

  // Value (lower price = better, if available)
  const bestPrice = Math.min(...all.filter((x) => x.price_used).map((x) => x.price_used!));
  categories.value = v.price_used && bestPrice
    ? Math.round((bestPrice / v.price_used) * 100)
    : 50;

  const total = Math.round(
    (categories.performance * WEIGHTS.performance +
      categories.safety * WEIGHTS.safety +
      categories.practicality * WEIGHTS.practicality +
      categories.efficiency * WEIGHTS.efficiency +
      categories.reliability * WEIGHTS.reliability +
      categories.value * WEIGHTS.value) / 100
  );

  return { total, categories };
}

function verdictPhrase(winner: { label: string; total: number }, runnerUp: { label: string; total: number }): string {
  const gap = winner.total - runnerUp.total;
  if (gap > 15) return `${winner.label} domine largement avec ${winner.total}/100.`;
  if (gap > 5) return `${winner.label} prend l'avantage avec ${winner.total}/100, mais ${runnerUp.label} reste comp\u00e9titif.`;
  return `Match serr\u00e9 ! ${winner.label} (${winner.total}) et ${runnerUp.label} (${runnerUp.total}) sont au coude-\u00e0-coude.`;
}

const CAT_LABELS: Record<string, string> = {
  performance: "Performance",
  safety: "S\u00e9curit\u00e9",
  practicality: "Praticit\u00e9",
  efficiency: "Efficacit\u00e9",
  reliability: "Fiabilit\u00e9",
  value: "Rapport qualit\u00e9/prix",
};

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#eab308"];

export function CompareVerdict({ vehicles }: CompareVerdictProps) {
  if (vehicles.length < 2) return null;

  const scores = vehicles.map((v) => ({
    ...v,
    ...scoreVehicle(v, vehicles),
  }));

  const sorted = [...scores].sort((a, b) => b.total - a.total);
  const winner = sorted[0];
  const runnerUp = sorted[1];

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] surface-2 p-5">
      <h3 className="mb-1 font-display text-lg font-bold text-white">Verdict</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        {verdictPhrase(winner, runnerUp)}
      </p>

      {/* Score bars */}
      <div className="space-y-3">
        {scores.map((v, i) => (
          <div key={v.id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium" style={{ color: COLORS[i % COLORS.length] }}>
                {v.label}
              </span>
              <span className="text-mono font-bold text-white">{v.total}/100</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${v.total}%`,
                  backgroundColor: COLORS[i % COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Category breakdown for winner */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Object.entries(CAT_LABELS).map(([key, label]) => {
          // Find who wins this category
          const catWinner = scores.reduce((best, v) =>
            (v.categories[key] || 0) > (best.categories[key] || 0) ? v : best
          );
          const catIdx = scores.indexOf(catWinner);
          return (
            <div key={key} className="rounded-lg border border-[var(--border-subtle)] surface-3 px-2.5 py-1.5 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
              <div
                className="text-mono text-sm font-bold"
                style={{ color: COLORS[catIdx % COLORS.length] }}
              >
                {catWinner.label.split(" ").slice(0, 2).join(" ")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
