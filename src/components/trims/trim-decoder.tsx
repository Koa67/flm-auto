"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check, X, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type {
  Trim,
  Equipment,
  TrimEquipment,
  EquipmentCategory,
  EQUIPMENT_CATEGORIES,
} from "@/types/vehicle";

const CATEGORY_INFO: Record<EquipmentCategory, { label: string; icon: string }> = {
  safety: { label: "Sécurité", icon: "🛡️" },
  comfort: { label: "Confort", icon: "🛋️" },
  tech: { label: "Technologie", icon: "📱" },
  exterior: { label: "Extérieur", icon: "🚗" },
  interior: { label: "Intérieur", icon: "🪑" },
  performance: { label: "Performance", icon: "⚡" },
  practical: { label: "Pratique", icon: "📦" },
};

interface TrimDecoderProps {
  generationId: string;
}

export function TrimDecoder({ generationId }: TrimDecoderProps) {
  const [trims, setTrims] = useState<Trim[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [trimEquipment, setTrimEquipment] = useState<TrimEquipment[]>([]);
  const [selectedTrims, setSelectedTrims] = useState<string[]>([]);
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false);
  const [expandedCats, setExpandedCats] = useState<string[]>(["safety", "comfort", "tech"]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/trims?generation_id=${generationId}`);
        const json = await res.json();
        const d = json.data;
        setTrims(d.trims || []);
        setEquipment(d.equipment || []);
        setTrimEquipment(d.trim_equipment || []);
        if (d.trims?.length >= 2) {
          setSelectedTrims(d.trims.slice(0, 2).map((t: Trim) => t.id));
        }
      } catch {
        // no trim data
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [generationId]);

  const equipByCategory = useMemo(() => {
    const grouped: Record<string, Equipment[]> = {};
    equipment.forEach((e) => {
      if (!grouped[e.category]) grouped[e.category] = [];
      grouped[e.category].push(e);
    });
    return grouped;
  }, [equipment]);

  const differingEquip = useMemo(() => {
    const differing = new Set<string>();
    equipment.forEach((eq) => {
      const statusByTrim = selectedTrims.map((trimId) => {
        const te = trimEquipment.find(
          (t) => t.trim_id === trimId && t.equipment_id === eq.id
        );
        return te?.status || "unavailable";
      });
      if (!statusByTrim.every((s) => s === statusByTrim[0])) {
        differing.add(eq.id);
      }
    });
    return differing;
  }, [selectedTrims, equipment, trimEquipment]);

  const getStatus = (trimId: string, equipId: string): TrimEquipment => {
    return (
      trimEquipment.find(
        (t) => t.trim_id === trimId && t.equipment_id === equipId
      ) || { trim_id: trimId, equipment_id: equipId, status: "unavailable" }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (trims.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Sparkles className="h-16 w-16 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">Pas de données finitions</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Les finitions de ce modèle ne sont pas encore référencées.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5" /> Décodeur de finitions
        </h3>
        <p className="text-sm text-muted-foreground">
          Comprendre ce qu&apos;inclut chaque finition
        </p>
      </div>

      {/* Trim selection */}
      <div className="flex flex-wrap gap-2">
        {trims.map((trim) => (
          <button
            key={trim.id}
            onClick={() =>
              setSelectedTrims((prev) =>
                prev.includes(trim.id)
                  ? prev.filter((id) => id !== trim.id)
                  : [...prev, trim.id].slice(-3)
              )
            }
            className={`rounded-lg border px-4 py-3 text-left transition ${
              selectedTrims.includes(trim.id)
                ? "border-primary bg-primary/10"
                : "border-border hover:border-muted-foreground"
            }`}
          >
            <p className="font-medium">{trim.name}</p>
            {trim.base_price && (
              <p className="text-sm text-muted-foreground">
                {trim.base_price.toLocaleString()} €
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Diff toggle */}
      <div className="flex items-center gap-2">
        <Switch
          checked={showOnlyDiffs}
          onCheckedChange={setShowOnlyDiffs}
          id="trim-diff"
        />
        <label
          htmlFor="trim-diff"
          className="cursor-pointer text-sm font-medium"
        >
          Différences uniquement ({differingEquip.size})
        </label>
      </div>

      {/* French summary */}
      {selectedTrims.length >= 2 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <h4 className="text-sm font-medium text-muted-foreground">En clair :</h4>
            {selectedTrims.map((trimId) => {
              const trim = trims.find((t) => t.id === trimId);
              if (!trim) return null;
              return (
                <p key={trimId} className="text-sm">
                  <span className="font-medium">{trim.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    : {trim.summary_fr || "Finition standard"}
                  </span>
                </p>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Equipment by category */}
      <div className="space-y-3">
        {Object.entries(equipByCategory).map(([cat, catEquipment]) => {
          const visible = showOnlyDiffs
            ? catEquipment.filter((eq) => differingEquip.has(eq.id))
            : catEquipment;
          if (visible.length === 0) return null;
          const catInfo =
            CATEGORY_INFO[cat as EquipmentCategory] || {
              label: cat,
              icon: "📦",
            };

          return (
            <div key={cat} className="overflow-hidden rounded-lg border">
              <button
                onClick={() =>
                  setExpandedCats((prev) =>
                    prev.includes(cat)
                      ? prev.filter((c) => c !== cat)
                      : [...prev, cat]
                  )
                }
                className="flex w-full items-center justify-between bg-muted/50 p-3 hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <span>{catInfo.icon}</span>
                  <span className="font-medium">{catInfo.label}</span>
                  <span className="text-xs text-muted-foreground">
                    ({visible.length})
                  </span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition ${
                    expandedCats.includes(cat) ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {expandedCats.includes(cat) && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="min-w-[180px] p-3 text-left text-sm text-muted-foreground">
                              Équipement
                            </th>
                            {selectedTrims.map((trimId) => (
                              <th
                                key={trimId}
                                className="min-w-[100px] p-3 text-center text-sm font-medium"
                              >
                                {trims.find((t) => t.id === trimId)?.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((eq) => {
                            const isDiff = differingEquip.has(eq.id);
                            return (
                              <tr
                                key={eq.id}
                                className={`border-t ${
                                  isDiff ? "bg-amber-500/5" : ""
                                }`}
                              >
                                <td className="p-3">
                                  <span className="text-sm">
                                    {eq.name_fr}
                                  </span>
                                  {isDiff && (
                                    <span className="ml-1 text-xs text-amber-500">
                                      ≠
                                    </span>
                                  )}
                                </td>
                                {selectedTrims.map((trimId) => {
                                  const status = getStatus(trimId, eq.id);
                                  return (
                                    <td
                                      key={trimId}
                                      className="p-3 text-center"
                                    >
                                      <StatusBadge
                                        status={status.status}
                                        price={status.option_price}
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Price comparison */}
      {selectedTrims.length >= 2 && trims.some((t) => t.base_price) && (
        <Card>
          <CardContent className="p-4">
            <h4 className="mb-3 text-sm font-medium text-muted-foreground">
              Comparatif prix
            </h4>
            <div className="flex gap-4">
              {selectedTrims.map((trimId) => {
                const trim = trims.find((t) => t.id === trimId);
                if (!trim) return null;
                const baseTrim = trims.find((t) => t.is_base_trim);
                const diff =
                  baseTrim && trim.base_price && baseTrim.base_price
                    ? trim.base_price - baseTrim.base_price
                    : 0;
                return (
                  <div key={trimId} className="flex-1 text-center">
                    <p className="text-xs text-muted-foreground">{trim.name}</p>
                    <p className="text-lg font-bold">
                      {trim.base_price
                        ? `${trim.base_price.toLocaleString()} €`
                        : "—"}
                    </p>
                    {diff > 0 && (
                      <p className="text-xs text-amber-500">
                        +{diff.toLocaleString()} € vs base
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  price,
}: {
  status: string;
  price?: number;
}) {
  switch (status) {
    case "standard":
      return (
        <span className="flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400">
          <Check className="h-3 w-3" /> Série
        </span>
      );
    case "option":
      return (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          +{price?.toLocaleString() || "?"}€
        </span>
      );
    case "pack":
      return (
        <Badge variant="secondary" className="text-xs">
          Pack
        </Badge>
      );
    default:
      return <X className="mx-auto h-4 w-4 text-muted-foreground/40" />;
  }
}
