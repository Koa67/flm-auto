"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Baby, Gauge, Mountain, Trophy } from "lucide-react";
import { useGamificationStore } from "@/lib/gamification-store";

type LensId = "famille" | "perf" | "outdoor" | "collection";

interface LensDef {
  id: LensId;
  label: string;
  icon: React.ElementType;
  color: string;
}

const LENSES: LensDef[] = [
  { id: "famille", label: "Famille", icon: Baby, color: "text-blue-400" },
  { id: "perf", label: "Performance", icon: Gauge, color: "text-red-400" },
  { id: "outdoor", label: "Outdoor", icon: Mountain, color: "text-green-400" },
  { id: "collection", label: "Collection", icon: Trophy, color: "text-amber-400" },
];

export interface ProfileLensData {
  // Famille
  safetyStars?: number | null;
  isofixPoints?: number | null;
  familyFitScore?: number | null;
  threeAcross?: boolean | null;
  trunkVolume?: number | null;
  seatingCapacity?: number | null;
  // Performance
  powerHp?: number | null;
  torqueNm?: number | null;
  acceleration?: number | null;
  topSpeed?: number | null;
  // Outdoor
  drivetrain?: string | null;
  bodyStyle?: string | null;
  // Collection
  yearStart?: number | null;
  yearEnd?: number | null;
  internalCode?: string | null;
  variantsCount?: number;
}

function Stat({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="text-center">
      <div className="text-mono text-xl font-bold text-white sm:text-2xl">
        {value}
        {suffix && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{suffix}</span>}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function FamilleView({ data }: { data: ProfileLensData }) {
  const stats: { label: string; value: string | number; suffix?: string }[] = [];
  if (data.safetyStars != null) stats.push({ label: "Euro NCAP", value: data.safetyStars, suffix: "/5\u2605" });
  if (data.isofixPoints != null) stats.push({ label: "ISOFIX", value: data.isofixPoints, suffix: "pts" });
  if (data.familyFitScore != null) stats.push({ label: "Score famille", value: data.familyFitScore, suffix: "/100" });
  if (data.trunkVolume != null) stats.push({ label: "Coffre", value: data.trunkVolume, suffix: "L" });
  if (data.seatingCapacity != null) stats.push({ label: "Places", value: data.seatingCapacity });
  if (data.threeAcross != null) stats.push({ label: "3-across", value: data.threeAcross ? "Oui" : "Non" });
  if (stats.length === 0) return <p className="text-sm text-muted-foreground">Pas de données famille disponibles.</p>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((s) => <Stat key={s.label} {...s} />)}
    </div>
  );
}

function PerfView({ data }: { data: ProfileLensData }) {
  const stats: { label: string; value: string | number; suffix?: string }[] = [];
  if (data.powerHp) stats.push({ label: "Puissance", value: data.powerHp, suffix: "ch" });
  if (data.torqueNm) stats.push({ label: "Couple", value: data.torqueNm, suffix: "Nm" });
  if (data.acceleration) stats.push({ label: "0-100 km/h", value: data.acceleration, suffix: "s" });
  if (data.topSpeed) stats.push({ label: "V.max", value: data.topSpeed, suffix: "km/h" });
  if (stats.length === 0) return <p className="text-sm text-muted-foreground">Pas de données performance disponibles.</p>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => <Stat key={s.label} {...s} />)}
    </div>
  );
}

function OutdoorView({ data }: { data: ProfileLensData }) {
  const stats: { label: string; value: string | number; suffix?: string }[] = [];
  if (data.drivetrain) stats.push({ label: "Transmission", value: data.drivetrain });
  if (data.bodyStyle) stats.push({ label: "Carrosserie", value: data.bodyStyle });
  if (data.trunkVolume) stats.push({ label: "Coffre", value: data.trunkVolume, suffix: "L" });
  if (data.powerHp) stats.push({ label: "Puissance", value: data.powerHp, suffix: "ch" });
  if (stats.length === 0) return <p className="text-sm text-muted-foreground">Pas de données outdoor disponibles.</p>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => <Stat key={s.label} {...s} />)}
    </div>
  );
}

function CollectionView({ data }: { data: ProfileLensData }) {
  const stats: { label: string; value: string | number; suffix?: string }[] = [];
  if (data.internalCode) stats.push({ label: "Code interne", value: data.internalCode });
  const years = data.yearStart ? `${data.yearStart}\u2013${data.yearEnd || "..."}` : null;
  if (years) stats.push({ label: "Production", value: years });
  if (data.bodyStyle) stats.push({ label: "Carrosserie", value: data.bodyStyle });
  if (data.variantsCount) stats.push({ label: "Motorisations", value: data.variantsCount });
  if (stats.length === 0) return <p className="text-sm text-muted-foreground">Pas de données collection disponibles.</p>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => <Stat key={s.label} {...s} />)}
    </div>
  );
}

const VIEWS: Record<LensId, React.ComponentType<{ data: ProfileLensData }>> = {
  famille: FamilleView,
  perf: PerfView,
  outdoor: OutdoorView,
  collection: CollectionView,
};

export function ProfileLens({ data }: { data: ProfileLensData }) {
  const [active, setActive] = useState<LensId | null>(null);

  return (
    <div className="mt-6">
      {/* Picker */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="mr-1 shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Vue
        </span>
        {LENSES.map((lens) => {
          const Icon = lens.icon;
          const isActive = active === lens.id;
          return (
            <button
              key={lens.id}
              onClick={() => {
                const next = isActive ? null : lens.id;
                setActive(next);
                if (next) useGamificationStore.getState().incrementStat("lensesUsed");
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? `border-current ${lens.color} surface-3`
                  : "border-[var(--border-subtle)] text-muted-foreground hover:text-white hover:surface-3"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {lens.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            data-testid="profile-lens-panel"
            className="mt-3 rounded-xl border border-[var(--border-subtle)] surface-2 p-4 sm:p-5"
          >
            {(() => {
              const View = VIEWS[active];
              return <View data={data} />;
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
