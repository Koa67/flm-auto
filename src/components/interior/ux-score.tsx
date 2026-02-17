"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UXInteriorRating } from "@/types/ux";
import { calculateUXScore, getUXVerdict } from "@/types/ux";

interface UXScoreProps {
  generationId: string;
}

export function UXScore({ generationId }: UXScoreProps) {
  const [rating, setRating] = useState<UXInteriorRating | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/ux-score?generation_id=${generationId}`);
        const json = await res.json();
        setRating(json.data || null);
      } catch {
        // no UX data
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [generationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!rating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Sparkles className="h-16 w-16 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">Pas de score UX</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          L&apos;évaluation UX de ce modèle n&apos;est pas encore disponible.
        </p>
      </div>
    );
  }

  const overallScore = rating.overall_ux_score ?? calculateUXScore(rating);
  const verdict = getUXVerdict(overallScore);

  const sections = [
    {
      label: "Boutons physiques",
      icon: "🎛️",
      score: Math.round(
        ((rating.physical_buttons_climate +
          rating.physical_buttons_volume +
          rating.physical_buttons_other) /
          3) *
          10
      ),
      details: [
        { label: "Climatisation", good: rating.physical_buttons_climate >= 7 },
        { label: "Volume", good: rating.physical_buttons_volume >= 7 },
        { label: "Autres", good: rating.physical_buttons_other >= 5 },
      ],
      verdict:
        rating.physical_buttons_climate >= 7 &&
        rating.physical_buttons_volume >= 7
          ? "Commandes essentielles accessibles"
          : "Trop de fonctions sur écran tactile",
    },
    {
      label: "Écran & Interface",
      icon: "📱",
      score: Math.round(rating.screen_responsiveness * 10),
      details: [
        { label: "Réactivité", good: rating.screen_responsiveness >= 7 },
        { label: "Menus peu profonds", good: rating.menu_depth <= 3 },
        { label: "Anti-reflets", good: rating.screen_glare_resistance >= 6 },
      ],
      verdict:
        rating.screen_responsiveness >= 7 ? "Interface fluide" : "Écran lent",
    },
    {
      label: "Visibilité",
      icon: "👁️",
      score: Math.round(
        (rating.visibility_front * 0.4 +
          rating.visibility_rear * 0.3 +
          rating.visibility_three_quarters * 0.3) *
          10
      ),
      details: [
        { label: "Avant", good: rating.visibility_front >= 7 },
        { label: "Arrière", good: rating.visibility_rear >= 6 },
        { label: "Angles morts", good: rating.visibility_three_quarters >= 5 },
      ],
      verdict:
        rating.visibility_front >= 7
          ? "Bonne visibilité"
          : "Angles morts importants",
    },
    {
      label: "Confort sièges",
      icon: "🪑",
      score: Math.round(
        (rating.seat_comfort_short * 0.3 + rating.seat_comfort_long * 0.7) * 10
      ),
      details: [
        { label: "Trajets courts", good: rating.seat_comfort_short >= 6 },
        { label: "Trajets longs", good: rating.seat_comfort_long >= 7 },
        {
          label: `${rating.seat_adjustments_driver} réglages`,
          good: rating.seat_adjustments_driver >= 8,
        },
      ],
      verdict:
        rating.seat_comfort_long >= 7
          ? "Confortable sur longs trajets"
          : "Fatiguant sur autoroute",
    },
    {
      label: "Insonorisation",
      icon: "🔇",
      score: Math.round(
        Math.max(0, 100 - (rating.noise_level_highway_db - 60) * 3)
      ),
      details: [
        {
          label: `Autoroute (${rating.noise_level_highway_db}dB)`,
          good: rating.noise_level_highway_db <= 68,
        },
        ...(rating.noise_level_city_db
          ? [
              {
                label: `Ville (${rating.noise_level_city_db}dB)`,
                good: rating.noise_level_city_db <= 55,
              },
            ]
          : []),
      ],
      verdict:
        rating.noise_level_highway_db <= 68
          ? "Habitacle calme"
          : "Bruyant à vitesse élevée",
    },
    {
      label: "Connectivité",
      icon: "📶",
      score: Math.round(
        (rating.wireless_carplay ? 25 : 0) +
          (rating.wireless_android_auto ? 25 : 0) +
          (rating.wireless_charging ? 15 : 0) +
          Math.min(
            (rating.usb_ports_front + rating.usb_ports_rear) * 5,
            20
          ) +
          (rating.hud_available ? 15 : 0)
      ),
      details: [
        { label: "CarPlay sans fil", good: rating.wireless_carplay },
        {
          label: "Android Auto sans fil",
          good: rating.wireless_android_auto,
        },
        {
          label: `USB (${rating.usb_ports_front + rating.usb_ports_rear} ports)`,
          good: rating.usb_ports_front + rating.usb_ports_rear >= 4,
        },
      ],
      verdict:
        rating.wireless_carplay && rating.wireless_android_auto
          ? "Connectivité complète"
          : "Connexion filaire requise",
    },
  ];

  const colorMap: Record<string, string> = {
    green: "text-green-600 dark:text-green-400",
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    orange: "text-orange-600 dark:text-orange-400",
    red: "text-red-600 dark:text-red-400",
  };

  const bgMap: Record<string, string> = {
    green: "bg-green-500/10 border-green-500/30",
    blue: "bg-blue-500/10 border-blue-500/30",
    amber: "bg-amber-500/10 border-amber-500/30",
    orange: "bg-orange-500/10 border-orange-500/30",
    red: "bg-red-500/10 border-red-500/30",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5" /> Score UX Intérieur
          </h3>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span className={`text-4xl font-bold ${colorMap[verdict.color]}`}>
              {overallScore}
            </span>
            <span className="text-lg text-muted-foreground">/100</span>
          </div>
          <p className={`text-sm ${colorMap[verdict.color]}`}>{verdict.text}</p>
        </div>
      </div>

      {/* Main verdict */}
      <Card className={`border ${bgMap[verdict.color]}`}>
        <CardContent className="p-4">
          <p className="font-medium">
            {rating.physical_buttons_climate >= 7
              ? "✓ Commandes physiques pour clim et volume"
              : "⚠️ Fonctions importantes sur écran tactile"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {rating.screen_responsiveness >= 7
              ? "Écran réactif."
              : "Écran parfois lent."}{" "}
            {rating.noise_level_highway_db <= 68
              ? "Habitacle bien insonorisé."
              : "Bruyant sur autoroute."}
          </p>
        </CardContent>
      </Card>

      {/* Detailed sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.label} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{section.icon}</span>
                <span className="font-medium">{section.label}</span>
              </div>
              <span
                className={`font-bold ${
                  section.score >= 70
                    ? "text-green-600 dark:text-green-400"
                    : section.score >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                }`}
              >
                {section.score}/100
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                className={`h-full ${
                  section.score >= 70
                    ? "bg-green-500"
                    : section.score >= 50
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${section.score}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              {section.details.map((detail, i) => (
                <span key={i} className="flex items-center gap-1">
                  {detail.good ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span
                    className={
                      detail.good ? "" : "text-muted-foreground"
                    }
                  >
                    {detail.label}
                  </span>
                </span>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">{section.verdict}</p>
          </div>
        ))}
      </div>

      {/* Quick facts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Ports USB",
            value: `${rating.usb_ports_front + rating.usb_ports_rear}`,
            good: rating.usb_ports_front + rating.usb_ports_rear >= 4,
          },
          {
            label: "CarPlay sans fil",
            value: rating.wireless_carplay ? "Oui" : "Non",
            good: rating.wireless_carplay,
          },
          {
            label: "Bruit autoroute",
            value: `${rating.noise_level_highway_db}dB`,
            good: rating.noise_level_highway_db <= 68,
          },
          {
            label: "HUD",
            value: rating.hud_available ? "Oui" : "Non",
            good: rating.hud_available,
          },
        ].map((fact, i) => (
          <Card key={i}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{fact.label}</p>
              <p className={`font-medium ${fact.good ? "" : "text-muted-foreground"}`}>
                {fact.good ? "✓ " : ""}
                {fact.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
