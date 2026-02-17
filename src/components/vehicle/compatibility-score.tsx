"use client";

import { useMemo } from "react";
import { useProfileStore, type UserProfile } from "@/lib/profile-store";
import { UserCheck } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import Link from "next/link";

interface VehicleData {
  power_hp?: number | null;
  fuel_type?: string | null;
  trunk_liters?: number | null;
  safety_stars?: number | null;
  seats?: number | null;
  isofix_count?: number | null;
}

interface CompatibilityScoreProps {
  vehicle: VehicleData;
}

function computeScore(profile: UserProfile, vehicle: VehicleData): { total: number; details: { label: string; score: number; max: number }[] } {
  const details: { label: string; score: number; max: number }[] = [];

  // Family fit (25 pts)
  let familyScore = 25;
  if (vehicle.seats != null && vehicle.seats < profile.family_size) {
    familyScore = Math.round((vehicle.seats / profile.family_size) * 15);
  }
  if (profile.child_seats_needed > 0 && vehicle.isofix_count != null) {
    if (vehicle.isofix_count < profile.child_seats_needed) {
      familyScore = Math.max(0, familyScore - 10);
    }
  }
  details.push({ label: "Famille", score: familyScore, max: 25 });

  // Fuel match (20 pts)
  let fuelScore = 20;
  if (profile.fuel_preference !== "any" && vehicle.fuel_type) {
    const ft = vehicle.fuel_type.toLowerCase();
    const pref = profile.fuel_preference;
    const match =
      (pref === "essence" && (ft.includes("petrol") || ft.includes("essence"))) ||
      (pref === "diesel" && ft.includes("diesel")) ||
      (pref === "electrique" && ft.includes("electr")) ||
      (pref === "hybride" && (ft.includes("hybrid") || ft.includes("hybride")));
    if (!match) fuelScore = 5;
  }
  details.push({ label: "Motorisation", score: fuelScore, max: 20 });

  // Trunk / space (20 pts)
  let spaceScore = 15;
  if (vehicle.trunk_liters != null) {
    if (profile.family_size >= 4 && vehicle.trunk_liters >= 450) spaceScore = 20;
    else if (profile.family_size >= 4 && vehicle.trunk_liters < 350) spaceScore = 8;
    else if (vehicle.trunk_liters >= 350) spaceScore = 18;
  }
  details.push({ label: "Espace", score: spaceScore, max: 20 });

  // Safety (20 pts)
  let safetyScore = 10;
  if (vehicle.safety_stars != null) {
    safetyScore = Math.round((vehicle.safety_stars / 5) * 20);
  }
  const hasSafetyPrio = profile.priorities.includes("safety");
  if (hasSafetyPrio && vehicle.safety_stars != null && vehicle.safety_stars < 4) {
    safetyScore = Math.max(0, safetyScore - 5);
  }
  details.push({ label: "S\u00e9curit\u00e9", score: safetyScore, max: 20 });

  // Priority alignment (15 pts)
  let prioScore = 10;
  if (profile.priorities.length > 0) {
    const topPrio = profile.priorities[0];
    if (topPrio === "performance" && vehicle.power_hp && vehicle.power_hp > 150) prioScore = 15;
    else if (topPrio === "economy" && vehicle.fuel_type?.toLowerCase().includes("electr")) prioScore = 15;
    else if (topPrio === "space" && vehicle.trunk_liters && vehicle.trunk_liters >= 500) prioScore = 15;
    else if (topPrio === "safety" && vehicle.safety_stars && vehicle.safety_stars >= 5) prioScore = 15;
    else if (topPrio === "reliability") prioScore = 12;
    else if (topPrio === "tech") prioScore = 12;
  }
  details.push({ label: "Priorit\u00e9s", score: prioScore, max: 15 });

  const total = details.reduce((sum, d) => sum + d.score, 0);
  return { total, details };
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-blue-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function CompatibilityScore({ vehicle }: CompatibilityScoreProps) {
  const profile = useProfileStore((s) => s.profile);

  const result = useMemo(
    () => (profile.completed ? computeScore(profile, vehicle) : null),
    [profile, vehicle]
  );

  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-4 text-center">
        <UserCheck className="mx-auto h-6 w-6 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          <Link href="/configurateur" className="text-primary hover:underline">
            Remplissez votre profil
          </Link>{" "}
          pour voir la compatibilit\u00e9 avec ce v\u00e9hicule.
        </p>
      </div>
    );
  }

  return (
    <FadeIn>
    <div className="rounded-xl border border-[var(--border-subtle)] surface-2 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Compatibilit\u00e9 profil</span>
        </div>
        <span className={`text-2xl font-bold font-mono ${scoreColor(result.total)}`}>
          {result.total}/100
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {result.details.map((d) => {
          const pct = Math.round((d.score / d.max) * 100);
          return (
            <div key={d.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-mono">{d.score}/{d.max}</span>
              </div>
              <AnimatedProgress
                value={d.score}
                max={d.max}
                className="mt-0.5 h-1.5"
                barClassName={scoreBg(pct)}
              />
            </div>
          );
        })}
      </div>
    </div>
    </FadeIn>
  );
}
