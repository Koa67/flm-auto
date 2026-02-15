"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { useGamificationStore } from "@/lib/gamification-store";
import {
  useProfileStore,
  type UsageType,
  type FuelPreference,
  type Priority,
} from "@/lib/profile-store";
import {
  Car,
  Fuel,
  Users,
  Target,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";

const STEPS = [
  { id: "budget", title: "Budget", icon: Wallet },
  { id: "usage", title: "Usage", icon: Car },
  { id: "family", title: "Famille", icon: Users },
  { id: "fuel", title: "Motorisation", icon: Fuel },
  { id: "priorities", title: "Priorités", icon: Target },
] as const;

const USAGE_OPTIONS: Array<{ value: UsageType; label: string; desc: string }> =
  [
    {
      value: "city",
      label: "Ville",
      desc: "Trajets courts, embouteillages fréquents",
    },
    {
      value: "highway",
      label: "Autoroute",
      desc: "Longs trajets, confort et autonomie",
    },
    {
      value: "mixed",
      label: "Mixte",
      desc: "Un peu de tout, polyvalence maximale",
    },
  ];

const FUEL_OPTIONS: Array<{
  value: FuelPreference;
  label: string;
  desc: string;
}> = [
  { value: "any", label: "Peu importe", desc: "Je suis ouvert à tout" },
  { value: "essence", label: "Essence", desc: "Polyvalent et accessible" },
  { value: "diesel", label: "Diesel", desc: "Pour les gros rouleurs" },
  {
    value: "electrique",
    label: "Électrique",
    desc: "Zéro émission, recharge à domicile",
  },
  {
    value: "hybride",
    label: "Hybride",
    desc: "Le meilleur des deux mondes",
  },
];

const PRIORITY_OPTIONS: Array<{
  value: Priority;
  label: string;
  desc: string;
}> = [
  { value: "economy", label: "Économie", desc: "Faible consommation et coûts" },
  { value: "safety", label: "Sécurité", desc: "5 étoiles NCAP, ADAS complets" },
  {
    value: "performance",
    label: "Performance",
    desc: "Puissance et plaisir de conduite",
  },
  { value: "space", label: "Espace", desc: "Grand coffre et habitabilité" },
  {
    value: "reliability",
    label: "Fiabilité",
    desc: "Peu de pannes, entretien simple",
  },
  {
    value: "tech",
    label: "Technologie",
    desc: "Écrans, connectivité, conduite autonome",
  },
];

function formatPrice(n: number): string {
  return n.toLocaleString("fr-FR") + " €";
}

export function ProfileWizard() {
  const [step, setStep] = useState(0);
  const { profile, setProfile } = useProfileStore();

  const currentStep = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  const canGoNext = (): boolean => {
    switch (step) {
      case 4:
        return profile.priorities.length >= 1;
      default:
        return true;
    }
  };

  const handleComplete = () => {
    setProfile({ completed: true });
    useGamificationStore.getState().incrementStat("profileCompleted");
    // Zustand store update triggers re-render — parent page shows ProfileResults
  };

  const togglePriority = (p: Priority) => {
    const current = profile.priorities;
    if (current.includes(p)) {
      setProfile({ priorities: current.filter((x) => x !== p) });
    } else if (current.length < 3) {
      setProfile({ priorities: [...current, p] });
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Étape {step + 1}/{STEPS.length}
          </span>
          <span>{currentStep.title}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Budget */}
          {step === 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Quel est votre budget ?</h2>
              <p className="text-muted-foreground">
                Prix du véhicule neuf ou occasion
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    Minimum: {formatPrice(profile.budget_min)}
                  </label>
                  <Slider
                    value={[profile.budget_min]}
                    onValueChange={([v]) => setProfile({ budget_min: v })}
                    min={5000}
                    max={100000}
                    step={1000}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Maximum: {formatPrice(profile.budget_max)}
                  </label>
                  <Slider
                    value={[profile.budget_max]}
                    onValueChange={([v]) => setProfile({ budget_max: v })}
                    min={5000}
                    max={150000}
                    step={1000}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Usage */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Votre usage principal ?</h2>
              <div className="space-y-3">
                {USAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setProfile({ usage: opt.value })}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      profile.usage === opt.value
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium">
                  Km/an estimés: {profile.km_annual.toLocaleString("fr-FR")} km
                </label>
                <Slider
                  value={[profile.km_annual]}
                  onValueChange={([v]) => setProfile({ km_annual: v })}
                  min={5000}
                  max={50000}
                  step={1000}
                  className="mt-2"
                />
              </div>
            </div>
          )}

          {/* Family */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Votre famille</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    Nombre de passagers habituels: {profile.family_size}
                  </label>
                  <Slider
                    value={[profile.family_size]}
                    onValueChange={([v]) => setProfile({ family_size: v })}
                    min={1}
                    max={7}
                    step={1}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Sièges enfants nécessaires: {profile.child_seats_needed}
                  </label>
                  <Slider
                    value={[profile.child_seats_needed]}
                    onValueChange={([v]) =>
                      setProfile({ child_seats_needed: v })
                    }
                    min={0}
                    max={3}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Fuel */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Motorisation préférée ?</h2>
              <div className="space-y-3">
                {FUEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setProfile({ fuel_preference: opt.value })}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      profile.fuel_preference === opt.value
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Priorities */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Vos priorités</h2>
              <p className="text-muted-foreground">
                Choisissez jusqu&apos;à 3 priorités
              </p>
              <div className="grid grid-cols-2 gap-3">
                {PRIORITY_OPTIONS.map((opt) => {
                  const selected = profile.priorities.includes(opt.value);
                  const disabled =
                    !selected && profile.priorities.length >= 3;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => togglePriority(opt.value)}
                      disabled={disabled}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        selected
                          ? "border-blue-500 bg-blue-500/10"
                          : disabled
                            ? "cursor-not-allowed opacity-50"
                            : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Précédent
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canGoNext()}
          >
            Suivant
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleComplete}
            disabled={!canGoNext()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Check className="mr-2 h-4 w-4" />
            Voir mes recommandations
          </Button>
        )}
      </div>
    </div>
  );
}
