"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronDown, Wrench, Calendar, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ENGINE_RED_FLAGS, type EngineRedFlag, type IssueSeverity } from "@/types/vehicle";

interface RedFlagAlertProps {
  engineCodes: string[];
}

function matchRedFlags(engineCodes: string[]): EngineRedFlag[] {
  const matched: EngineRedFlag[] = [];
  const seen = new Set<string>();

  for (const code of engineCodes) {
    if (!code) continue;
    const upper = code.toUpperCase().trim();
    for (const [key, flag] of Object.entries(ENGINE_RED_FLAGS)) {
      if (seen.has(key)) continue;
      const matches = flag.patterns.some((p) => upper.includes(p.toUpperCase()));
      if (matches) {
        matched.push(flag);
        seen.add(key);
      }
    }
  }
  return matched;
}

const SEVERITY_CONFIG: Record<
  IssueSeverity,
  { label: string; bg: string; border: string; text: string; badge: string }
> = {
  critical: {
    label: "Critique",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-700 dark:text-red-400",
    badge: "bg-red-500/20 text-red-700 dark:text-red-400",
  },
  major: {
    label: "Majeur",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  },
  moderate: {
    label: "Modéré",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-700 dark:text-yellow-400",
    badge: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  },
  minor: {
    label: "Mineur",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  },
};

export function RedFlagAlert({ engineCodes }: RedFlagAlertProps) {
  const flags = matchRedFlags(engineCodes);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (flags.length === 0) return null;

  const hasCritical = flags.some((f) => f.severity === "critical");

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Header banner */}
      <div
        className={`flex items-center gap-3 rounded-lg border p-3 ${
          hasCritical
            ? "border-red-500/30 bg-red-500/10"
            : "border-amber-500/30 bg-amber-500/10"
        }`}
      >
        <AlertTriangle
          className={`h-5 w-5 shrink-0 ${
            hasCritical
              ? "text-red-600 dark:text-red-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        />
        <div className="flex-1">
          <p
            className={`text-sm font-semibold ${
              hasCritical
                ? "text-red-700 dark:text-red-400"
                : "text-amber-700 dark:text-amber-400"
            }`}
          >
            {flags.length === 1
              ? "Problème moteur connu"
              : `${flags.length} problèmes moteur connus`}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasCritical
              ? "Ce véhicule utilise un moteur avec un défaut critique documenté."
              : "Ce véhicule utilise un moteur avec des problèmes fréquemment signalés."}
          </p>
        </div>
      </div>

      {/* Individual flag cards */}
      {flags.map((flag, i) => {
        const config = SEVERITY_CONFIG[flag.severity];
        const isExpanded = expandedIdx === i;

        return (
          <Card key={i} className={`overflow-hidden border ${config.border}`}>
            <button
              onClick={() => setExpandedIdx(isExpanded ? null : i)}
              className={`flex w-full items-center gap-3 p-4 text-left transition hover:bg-muted/50`}
            >
              <AlertTriangle className={`h-4 w-4 shrink-0 ${config.text}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-semibold ${config.text}`}>
                    {flag.title_fr}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${config.badge}`}
                  >
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {flag.brand} — {flag.engine_family}
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <CardContent className={`space-y-4 border-t px-4 pb-4 pt-3 ${config.bg}`}>
                    {/* Description */}
                    <p className="text-sm">{flag.description_fr}</p>

                    {/* Symptoms */}
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        Symptômes à surveiller
                      </p>
                      <ul className="space-y-1">
                        {flag.symptoms_fr.map((s, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <span className={`mt-0.5 ${config.text}`}>•</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Meta info row */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {flag.affected_years && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Années : {flag.affected_years}
                        </span>
                      )}
                      {flag.repair_cost_range && (
                        <span className="flex items-center gap-1">
                          <Wrench className="h-3 w-3" />
                          Réparation : {flag.repair_cost_range}
                        </span>
                      )}
                      {flag.source && (
                        <span className="flex items-center gap-1">
                          Source : {flag.source}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        );
      })}
    </motion.div>
  );
}
