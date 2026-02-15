"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useProfileStore } from "@/lib/profile-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  VehicleResultCard,
  type VehicleResultData,
} from "@/components/configurateur/vehicle-result-card";
import {
  Wallet,
  Users,
  MapPin,
  Zap,
  Package,
  Armchair,
  ListOrdered,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  Baby,
  GripVertical,
  Car,
  SlidersHorizontal,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { id: "budget", label: "Budget", icon: Wallet },
  { id: "famille", label: "Famille", icon: Users },
  { id: "usage", label: "Usage", icon: MapPin },
  { id: "motorisation", label: "Motorisation", icon: Zap },
  { id: "coffre", label: "Coffre", icon: Package },
  { id: "confort", label: "Confort", icon: Armchair },
  { id: "priorites", label: "Priorites", icon: ListOrdered },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const FUEL_OPTIONS = [
  { value: "petrol", label: "Essence" },
  { value: "diesel", label: "Diesel" },
  { value: "electric", label: "Electrique" },
  { value: "hybrid", label: "Hybride" },
  { value: "plugin_hybrid", label: "PHEV" },
] as const;

const USAGE_OPTIONS = [
  { value: "ville", label: "Ville", desc: "Courts trajets urbains" },
  { value: "route", label: "Route", desc: "Nationales et departementales" },
  { value: "autoroute", label: "Autoroute", desc: "Longs trajets rapides" },
  { value: "tout_terrain", label: "Tout-terrain", desc: "Chemins et hors-piste" },
] as const;

const CARGO_PRESETS = [
  { value: 300, label: "300 L", desc: "Citadine" },
  { value: 450, label: "450 L", desc: "Compacte" },
  { value: 550, label: "550 L", desc: "Familiale" },
  { value: 700, label: "700 L", desc: "SUV / Break" },
] as const;

const PRIORITY_OPTIONS = [
  { id: "prix", label: "Prix" },
  { id: "conso", label: "Consommation" },
  { id: "espace", label: "Espace" },
  { id: "fiabilite", label: "Fiabilite" },
  { id: "confort", label: "Confort" },
  { id: "securite", label: "Securite" },
] as const;

// ---------------------------------------------------------------------------
// Criteria State
// ---------------------------------------------------------------------------

interface Criteria {
  budget_min: number;
  budget_max: number;
  achat_type: "neuf" | "occasion" | "les_deux";
  km_annuel: number;

  passagers: number;
  child_seats: number;
  three_across: boolean;

  usage: string[];

  fuel_types: string[];
  power_min: number;
  power_max: number;
  exclude_red_flags: boolean;

  cargo_min: number;

  ux_score_min: number;
  physical_buttons: boolean;
  wireless_carplay: boolean;
  ncap_min: number;

  priorities: string[];
}

const DEFAULT_CRITERIA: Criteria = {
  budget_min: 5000,
  budget_max: 50000,
  achat_type: "les_deux",
  km_annuel: 15000,

  passagers: 5,
  child_seats: 0,
  three_across: false,

  usage: [],

  fuel_types: [],
  power_min: 0,
  power_max: 500,
  exclude_red_flags: false,

  cargo_min: 0,

  ux_score_min: 0,
  physical_buttons: false,
  wireless_carplay: false,
  ncap_min: 0,

  priorities: ["prix", "conso", "espace", "fiabilite", "confort", "securite"],
};

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatEur(val: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatKm(val: number): string {
  return new Intl.NumberFormat("fr-FR").format(val) + " km/an";
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function InverseConfigurator() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [criteria, setCriteria] = useState<Criteria>(DEFAULT_CRITERIA);
  const [results, setResults] = useState<VehicleResultData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const prefilled = useRef(false);

  // Pre-fill from saved profile
  useEffect(() => {
    if (prefilled.current) return;
    const profile = useProfileStore.getState().profile;
    if (!profile.completed) return;
    prefilled.current = true;
    const FUEL_MAP: Record<string, string> = {
      essence: "petrol",
      diesel: "diesel",
      electrique: "electric",
      hybride: "hybrid",
    };
    setCriteria((prev) => ({
      ...prev,
      budget_min: profile.budget_min,
      budget_max: profile.budget_max,
      km_annuel: profile.km_annual,
      passagers: Math.max(profile.family_size, 2),
      child_seats: profile.child_seats_needed,
      fuel_types: profile.fuel_preference !== "any" ? [FUEL_MAP[profile.fuel_preference] || ""] : [],
    }));
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const progress = ((step + 1) / STEPS.length) * 100;

  function goNext() {
    if (step < STEPS.length - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }

  function goPrev() {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }

  function updateCriteria<K extends keyof Criteria>(key: K, value: Criteria[K]) {
    setCriteria((prev) => ({ ...prev, [key]: value }));
  }

  const handleSearch = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch("/api/configurateur/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget_min: criteria.budget_min,
          budget_max: criteria.budget_max,
          achat_type: criteria.achat_type,
          passagers: criteria.passagers,
          child_seats: criteria.child_seats,
          three_across: criteria.three_across,
          usage: criteria.usage,
          fuel_types: criteria.fuel_types.length > 0 ? criteria.fuel_types : undefined,
          power_min: criteria.power_min > 0 ? criteria.power_min : undefined,
          power_max: criteria.power_max < 500 ? criteria.power_max : undefined,
          exclude_red_flags: criteria.exclude_red_flags,
          cargo_min: criteria.cargo_min > 0 ? criteria.cargo_min : undefined,
          ux_score_min: criteria.ux_score_min > 0 ? criteria.ux_score_min : undefined,
          physical_buttons: criteria.physical_buttons || undefined,
          wireless_carplay: criteria.wireless_carplay || undefined,
          ncap_min: criteria.ncap_min > 0 ? criteria.ncap_min : undefined,
          priorities: criteria.priorities,
          limit: 30,
        }),
        signal: abortRef.current.signal,
      });

      const json = await res.json();
      setResults(json.results || []);
      setTotal(json.total || 0);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [criteria]);

  const isLastStep = step === STEPS.length - 1;

  function buildRechercheUrl(): string {
    const p = new URLSearchParams();
    if (criteria.fuel_types.length > 0) p.set("fuel", criteria.fuel_types.join(","));
    if (criteria.power_min > 0) p.set("power_min", String(criteria.power_min));
    if (criteria.power_max < 500) p.set("power_max", String(criteria.power_max));
    if (criteria.ncap_min > 0) p.set("ncap_min", String(criteria.ncap_min));
    if (criteria.cargo_min > 0) p.set("trunk_min", String(criteria.cargo_min));
    return `/recherche?${p.toString()}`;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <Car className="h-8 w-8" />
          Configurateur Inverse
        </h1>
        <p className="mt-2 text-muted-foreground">
          Decrivez vos besoins, on trouve les vehicules qui correspondent.
        </p>
      </div>

      {!searched && (
        <>
          {/* Progress */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Etape {step + 1} sur {STEPS.length}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>

          {/* Step Indicators */}
          <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setDirection(i > step ? 1 : -1);
                    setStep(i);
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Step Content */}
          <Card className="relative min-h-[320px] overflow-hidden">
            <CardContent className="p-6">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={STEPS[step].id}
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  {step === 0 && (
                    <StepBudget criteria={criteria} update={updateCriteria} />
                  )}
                  {step === 1 && (
                    <StepFamille criteria={criteria} update={updateCriteria} />
                  )}
                  {step === 2 && (
                    <StepUsage criteria={criteria} update={updateCriteria} />
                  )}
                  {step === 3 && (
                    <StepMotorisation criteria={criteria} update={updateCriteria} />
                  )}
                  {step === 4 && (
                    <StepCoffre criteria={criteria} update={updateCriteria} />
                  )}
                  {step === 5 && (
                    <StepConfort criteria={criteria} update={updateCriteria} />
                  )}
                  {step === 6 && (
                    <StepPriorites criteria={criteria} update={updateCriteria} />
                  )}
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={step === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Precedent
            </Button>

            {isLastStep ? (
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Trouver mes vehicules
              </Button>
            ) : (
              <Button onClick={goNext}>
                Suivant
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </>
      )}

      {/* Results */}
      {searched && (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {total} vehicule{total !== 1 ? "s" : ""} trouv&eacute;{total !== 1 ? "s" : ""}
              </h2>
              <p className="text-sm text-muted-foreground">
                {results.length < total
                  ? `Affichage des ${results.length} meilleurs resultats`
                  : "Tries par pertinence"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearched(false);
                  setResults([]);
                }}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Modifier les criteres
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(buildRechercheUrl())}
              >
                <SlidersHorizontal className="mr-1 h-4 w-4" />
                Affiner dans la recherche
              </Button>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((v, i) => (
                <VehicleResultCard key={v.generation_id} vehicle={v} rank={i} />
              ))}
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="py-20 text-center">
              <Car className="mx-auto h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">
                Aucun vehicule ne correspond
              </h3>
              <p className="mt-2 text-muted-foreground">
                Essayez d&apos;elargir vos criteres (budget, puissance, volume de coffre).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step Components
// ---------------------------------------------------------------------------

interface StepProps {
  criteria: Criteria;
  update: <K extends keyof Criteria>(key: K, value: Criteria[K]) => void;
}

// Step 1: Budget
function StepBudget({ criteria, update }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Budget</h2>
        <p className="text-sm text-muted-foreground">
          Definissez votre fourchette de prix et le type d&apos;achat.
        </p>
      </div>

      {/* Price range */}
      <div>
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">Fourchette de prix</span>
          <span className="text-muted-foreground">
            {formatEur(criteria.budget_min)} &mdash; {formatEur(criteria.budget_max)}
          </span>
        </div>
        <Slider
          min={0}
          max={200000}
          step={1000}
          value={[criteria.budget_min, criteria.budget_max]}
          onValueChange={([min, max]: number[]) => {
            update("budget_min", min);
            update("budget_max", max);
          }}
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>0 &euro;</span>
          <span>200 000 &euro;</span>
        </div>
      </div>

      {/* Achat type */}
      <div>
        <span className="mb-2 block text-sm font-medium">Type d&apos;achat</span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "neuf", label: "Neuf" },
              { value: "occasion", label: "Occasion" },
              { value: "les_deux", label: "Les deux" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => update("achat_type", opt.value)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                criteria.achat_type === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Km annuel */}
      <div>
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">Kilometrage annuel</span>
          <span className="text-muted-foreground">{formatKm(criteria.km_annuel)}</span>
        </div>
        <Slider
          min={5000}
          max={60000}
          step={1000}
          value={[criteria.km_annuel]}
          onValueChange={([v]: number[]) => update("km_annuel", v)}
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>5 000 km</span>
          <span>60 000 km</span>
        </div>
      </div>
    </div>
  );
}

// Step 2: Famille
function StepFamille({ criteria, update }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Famille</h2>
        <p className="text-sm text-muted-foreground">
          Combien de passagers et de sieges enfants ?
        </p>
      </div>

      {/* Passagers */}
      <div>
        <span className="mb-2 block text-sm font-medium">Nombre de passagers</span>
        <div className="flex flex-wrap gap-2">
          {[2, 4, 5, 7, 9].map((n) => (
            <button
              key={n}
              onClick={() => update("passagers", n)}
              className={`flex h-12 w-12 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                criteria.passagers === n
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Sieges enfants */}
      <div>
        <span className="mb-2 block text-sm font-medium">Sieges enfants (ISOFIX)</span>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => update("child_seats", n)}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                criteria.child_seats === n
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <Baby className="h-3.5 w-3.5" />
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* 3-across */}
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50">
        <input
          type="checkbox"
          checked={criteria.three_across}
          onChange={(e) => update("three_across", e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <div>
          <span className="text-sm font-medium">3 sieges cote a cote</span>
          <p className="text-xs text-muted-foreground">
            La banquette arriere doit accueillir 3 sieges enfants.
          </p>
        </div>
      </label>
    </div>
  );
}

// Step 3: Usage
function StepUsage({ criteria, update }: StepProps) {
  function toggleUsage(val: string) {
    const next = criteria.usage.includes(val)
      ? criteria.usage.filter((u) => u !== val)
      : [...criteria.usage, val];
    update("usage", next);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Usage</h2>
        <p className="text-sm text-muted-foreground">
          Selectionnez vos types de conduite habituels.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {USAGE_OPTIONS.map((opt) => {
          const active = criteria.usage.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggleUsage(opt.value)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-accent/50"
              }`}
            >
              <span className={`text-sm font-semibold ${active ? "text-primary" : ""}`}>
                {opt.label}
              </span>
              <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Step 4: Motorisation
function StepMotorisation({ criteria, update }: StepProps) {
  function toggleFuel(val: string) {
    const next = criteria.fuel_types.includes(val)
      ? criteria.fuel_types.filter((f) => f !== val)
      : [...criteria.fuel_types, val];
    update("fuel_types", next);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Motorisation</h2>
        <p className="text-sm text-muted-foreground">
          Choisissez le type de carburant et la plage de puissance.
        </p>
      </div>

      {/* Fuel types */}
      <div>
        <span className="mb-2 block text-sm font-medium">Type de carburant</span>
        <div className="flex flex-wrap gap-2">
          {FUEL_OPTIONS.map((opt) => {
            const active = criteria.fuel_types.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleFuel(opt.value)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {criteria.fuel_types.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Aucune selection = tous les carburants
          </p>
        )}
      </div>

      {/* Power range */}
      <div>
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">Plage de puissance</span>
          <span className="text-muted-foreground">
            {criteria.power_min} &mdash; {criteria.power_max} ch
          </span>
        </div>
        <Slider
          min={0}
          max={500}
          step={10}
          value={[criteria.power_min, criteria.power_max]}
          onValueChange={([min, max]: number[]) => {
            update("power_min", min);
            update("power_max", max);
          }}
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>0 ch</span>
          <span>500 ch</span>
        </div>
      </div>

      {/* Red flags */}
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50">
        <input
          type="checkbox"
          checked={criteria.exclude_red_flags}
          onChange={(e) => update("exclude_red_flags", e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <div>
          <span className="text-sm font-medium">Exclure les moteurs a problemes connus</span>
          <p className="text-xs text-muted-foreground">
            PureTech, N47, Theta II, etc. &mdash; moteurs avec des defauts recurrents.
          </p>
        </div>
      </label>
    </div>
  );
}

// Step 5: Coffre
function StepCoffre({ criteria, update }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Coffre</h2>
        <p className="text-sm text-muted-foreground">
          Quel volume minimum de coffre vous faut-il ?
        </p>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CARGO_PRESETS.map((preset) => {
          const active = criteria.cargo_min === preset.value;
          return (
            <button
              key={preset.value}
              onClick={() => update("cargo_min", active ? 0 : preset.value)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-4 transition-colors ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-accent/50"
              }`}
            >
              <Package className={`h-6 w-6 ${active ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-semibold ${active ? "text-primary" : ""}`}>
                {preset.label}
              </span>
              <span className="text-xs text-muted-foreground">{preset.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Custom slider */}
      <div>
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">Volume minimum personnalise</span>
          <span className="text-muted-foreground">{criteria.cargo_min} L</span>
        </div>
        <Slider
          min={0}
          max={1000}
          step={50}
          value={[criteria.cargo_min]}
          onValueChange={([v]: number[]) => update("cargo_min", v)}
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>0 L</span>
          <span>1 000 L</span>
        </div>
      </div>
    </div>
  );
}

// Step 6: Confort
function StepConfort({ criteria, update }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Confort &amp; Securite</h2>
        <p className="text-sm text-muted-foreground">
          Quels criteres de confort et de securite sont importants ?
        </p>
      </div>

      {/* UX score */}
      <div>
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">Score UX minimum</span>
          <span className="text-muted-foreground">
            {criteria.ux_score_min > 0 ? `${criteria.ux_score_min}/100` : "Pas de minimum"}
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[criteria.ux_score_min]}
          onValueChange={([v]: number[]) => update("ux_score_min", v)}
        />
      </div>

      {/* NCAP */}
      <div>
        <span className="mb-2 block text-sm font-medium">Euro NCAP minimum</span>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => update("ncap_min", n)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                criteria.ncap_min === n
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {n === 0 ? (
                "Tous"
              ) : (
                <>
                  {"★".repeat(n)}
                  {"☆".repeat(5 - n)}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50">
          <input
            type="checkbox"
            checked={criteria.physical_buttons}
            onChange={(e) => update("physical_buttons", e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <div>
            <span className="text-sm font-medium">Boutons physiques (clim, volume)</span>
            <p className="text-xs text-muted-foreground">
              Preference pour les commandes physiques plutot que tout-ecran.
            </p>
          </div>
        </label>

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50">
          <input
            type="checkbox"
            checked={criteria.wireless_carplay}
            onChange={(e) => update("wireless_carplay", e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <div>
            <span className="text-sm font-medium">CarPlay sans fil</span>
            <p className="text-xs text-muted-foreground">
              Apple CarPlay / Android Auto en connexion sans fil.
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

// Step 7: Priorites
function StepPriorites({ criteria, update }: StepProps) {
  function moveUp(index: number) {
    if (index <= 0) return;
    const next = [...criteria.priorities];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    update("priorities", next);
  }

  function moveDown(index: number) {
    if (index >= criteria.priorities.length - 1) return;
    const next = [...criteria.priorities];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    update("priorities", next);
  }

  const labelMap: Record<string, string> = {
    prix: "Prix",
    conso: "Consommation",
    espace: "Espace",
    fiabilite: "Fiabilite",
    confort: "Confort",
    securite: "Securite",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Priorites</h2>
        <p className="text-sm text-muted-foreground">
          Ordonnez vos criteres du plus important au moins important.
        </p>
      </div>

      <div className="space-y-2">
        {criteria.priorities.map((p, i) => (
          <div
            key={p}
            className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Badge
              variant="outline"
              className="flex h-6 w-6 items-center justify-center rounded-full p-0 text-xs"
            >
              {i + 1}
            </Badge>
            <span className="flex-1 text-sm font-medium">{labelMap[p] || p}</span>
            <div className="flex gap-1">
              <button
                onClick={() => moveUp(i)}
                disabled={i === 0}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4 rotate-90" />
              </button>
              <button
                onClick={() => moveDown(i)}
                disabled={i === criteria.priorities.length - 1}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4 rotate-90" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Le critere en position 1 aura le plus de poids dans le classement des resultats.
      </p>
    </div>
  );
}
