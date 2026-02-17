'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, ExternalLink, Shield } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────

interface RecallAlertsProps {
  generationId: string;
}

interface Recall {
  id: string;
  component: string;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  recall_date: string;
  issue_summary: string;
  issue_description: string;
  remedy: string;
  source_url: string | null;
  source: string | null;
  recall_number: string | null;
}

// ─── Constants ─────────────────────────────────────────

const COMPONENT_LABELS: Record<string, string> = {
  airbag: 'Airbag',
  brakes: 'Freins',
  fuel_system: 'Carburant',
  steering: 'Direction',
  electrical: '\u00c9lectrique',
  engine: 'Moteur',
  transmission: 'Transmission',
  suspension: 'Suspension',
  tires_wheels: 'Pneus/Roues',
  seats_belts: 'Si\u00e8ges/Ceintures',
  doors_locks: 'Portes/Serrures',
  lights: '\u00c9clairage',
  software: 'Logiciel',
  other: 'Autre',
};

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: {
    bg: 'bg-red-500/10 dark:bg-red-500/20',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-500/30',
  },
  high: {
    bg: 'bg-orange-500/10 dark:bg-orange-500/20',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500/30',
  },
  medium: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
  },
  low: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
  },
};

const RISK_LABELS: Record<string, string> = {
  critical: 'Critique',
  high: '\u00c9lev\u00e9',
  medium: 'Mod\u00e9r\u00e9',
  low: 'Faible',
};

// ─── Component ─────────────────────────────────────────

export function RecallAlerts({ generationId }: RecallAlertsProps) {
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecalls() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/recalls?generation_id=${generationId}`);
        if (!res.ok) {
          throw new Error('Erreur lors du chargement des rappels');
        }
        const json = await res.json();
        setRecalls(json.recalls || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    }
    fetchRecalls();
  }, [generationId]);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function formatDate(dateStr: string): string {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
          >
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="ml-auto h-5 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        </div>
      </div>
    );
  }

  // No recalls
  if (recalls.length === 0) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            Aucun rappel connu pour ce v\u00e9hicule
          </span>
        </div>
      </div>
    );
  }

  // Count critical + high recalls
  const criticalHighCount = recalls.filter(
    (r) => r.risk_level === 'critical' || r.risk_level === 'high'
  ).length;

  return (
    <div className="space-y-4">
      {/* Warning banner for critical/high recalls */}
      {criticalHighCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {criticalHighCount} rappel{criticalHighCount > 1 ? 's' : ''} critique
              {criticalHighCount > 1 ? 's' : ''} ou de niveau \u00e9lev\u00e9
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80">
              V\u00e9rifiez si votre v\u00e9hicule est concern\u00e9 aupr\u00e8s de votre concessionnaire
            </p>
          </div>
        </div>
      )}

      {/* Recall count */}
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {recalls.length} rappel{recalls.length > 1 ? 's' : ''} enregistr\u00e9
        {recalls.length > 1 ? 's' : ''}
      </p>

      {/* Recall cards */}
      <div className="space-y-2">
        {recalls.map((recall) => {
          const isExpanded = expandedId === recall.id;
          const colors = RISK_COLORS[recall.risk_level] || RISK_COLORS.low;
          const componentLabel = COMPONENT_LABELS[recall.component] || recall.component;
          const riskLabel = RISK_LABELS[recall.risk_level] || recall.risk_level;

          return (
            <div
              key={recall.id}
              className={`overflow-hidden rounded-lg border transition-colors ${colors.border} ${
                isExpanded ? colors.bg : 'bg-white dark:bg-zinc-900'
              }`}
            >
              {/* Header - clickable */}
              <button
                onClick={() => toggleExpand(recall.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <AlertTriangle className={`h-4 w-4 shrink-0 ${colors.text}`} />

                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {componentLabel}
                  </span>
                  {recall.recall_date && (
                    <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(recall.recall_date)}
                    </span>
                  )}
                </div>

                {/* Risk badge */}
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text}`}
                >
                  {riskLabel}
                </span>

                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Expanded details */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
                      {/* Summary */}
                      {recall.issue_summary && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            R\u00e9sum\u00e9
                          </h4>
                          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                            {recall.issue_summary}
                          </p>
                        </div>
                      )}

                      {/* Description */}
                      {recall.issue_description && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Description
                          </h4>
                          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                            {recall.issue_description}
                          </p>
                        </div>
                      )}

                      {/* Remedy */}
                      {recall.remedy && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Rem\u00e8de
                          </h4>
                          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                            {recall.remedy}
                          </p>
                        </div>
                      )}

                      {/* Campaign number */}
                      {recall.recall_number && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Campagne : {recall.recall_number}
                        </p>
                      )}

                      {/* Source link */}
                      {recall.source_url && (
                        <a
                          href={recall.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Voir la source{recall.source ? ` (${recall.source})` : ''}
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
