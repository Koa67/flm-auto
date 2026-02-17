"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Plus, Minus, Trash2, Check, X, AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRESET_CARGO_ITEMS, CARGO_CATEGORIES, type CargoItem } from "@/lib/cargo-items";

// ─── Types ─────────────────────────────────────────────

interface CargoData {
  trunk_volume_liters: number | null;
  trunk_volume_max_liters: number | null;
  frunk_volume_liters: number | null;
  max_load_kg: number | null;
  vehicle_length_mm: number | null;
}

interface LoadItem {
  item: CargoItem;
  quantity: number;
}

// ─── Component ──────────────────────────────────────────

interface CargoCalculatorProps {
  vehicleName: string;
  cargoData: CargoData;
}

export function CargoCalculator({ vehicleName, cargoData }: CargoCalculatorProps) {
  const [load, setLoad] = useState<LoadItem[]>([]);
  const [seatsDown, setSeatsDown] = useState(false);

  const availableVolume = seatsDown
    ? (cargoData.trunk_volume_max_liters || cargoData.trunk_volume_liters || 0)
    : (cargoData.trunk_volume_liters || 0);

  const usedVolume = useMemo(
    () => load.reduce((sum, l) => sum + l.item.volume_liters * l.quantity, 0),
    [load]
  );

  const totalWeight = useMemo(
    () => load.reduce((sum, l) => sum + l.item.weight_kg * l.quantity, 0),
    [load]
  );

  const totalItems = load.reduce((sum, l) => sum + l.quantity, 0);
  const fits = availableVolume > 0 && usedVolume <= availableVolume;
  const fillPct = availableVolume > 0 ? Math.min(100, (usedVolume / availableVolume) * 100) : 0;
  const maxLoad = cargoData.max_load_kg || 500;
  const weightOk = totalWeight <= maxLoad;

  // Dimension warnings
  const warnings = useMemo(() => {
    const w: string[] = [];
    if (!fits && usedVolume > 0) {
      w.push(`Volume d\u00e9pass\u00e9 de ${usedVolume - availableVolume} L`);
    }
    if (!weightOk) {
      w.push(`Poids d\u00e9pass\u00e9 : ${totalWeight} kg / ${maxLoad} kg max`);
    }
    load.forEach((l) => {
      if (l.item.length_cm > 160 && !seatsDown) {
        w.push(`${l.item.name_fr} (${l.item.length_cm} cm) peut n\u00e9cessiter les si\u00e8ges rabattus`);
      }
    });
    return w;
  }, [load, fits, usedVolume, availableVolume, weightOk, totalWeight, maxLoad, seatsDown]);

  function addItem(item: CargoItem) {
    setLoad((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        return prev.map((l) =>
          l.item.id === item.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  }

  function changeQuantity(id: string, delta: number) {
    setLoad((prev) =>
      prev
        .map((l) =>
          l.item.id === id ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l
        )
        .filter((l) => l.quantity > 0)
    );
  }

  function removeItem(id: string) {
    setLoad((prev) => prev.filter((l) => l.item.id !== id));
  }

  function clearAll() {
    setLoad([]);
  }

  const hasLoad = load.length > 0;
  const allOk = hasLoad && fits && warnings.length === 0;
  const hasWarnings = hasLoad && fits && warnings.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Package className="h-5 w-5" />
          Calculateur de coffre
        </h3>
        <p className="text-sm text-muted-foreground">
          {vehicleName} &mdash; Coffre : {availableVolume > 0 ? `${availableVolume} L` : "non mesur\u00e9"}
          {cargoData.trunk_volume_max_liters && !seatsDown && (
            <span> ({cargoData.trunk_volume_max_liters} L si\u00e8ges rabattus)</span>
          )}
        </p>
      </div>

      {/* Trunk stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3 text-center">
          <div className="text-xl font-bold">{cargoData.trunk_volume_liters || "\u2014"}</div>
          <div className="text-xs text-muted-foreground">Coffre (L)</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-xl font-bold">{cargoData.trunk_volume_max_liters || "\u2014"}</div>
          <div className="text-xs text-muted-foreground">Si\u00e8ges rabattus (L)</div>
        </div>
        {cargoData.frunk_volume_liters && (
          <div className="rounded-lg border p-3 text-center">
            <div className="text-xl font-bold">{cargoData.frunk_volume_liters}</div>
            <div className="text-xs text-muted-foreground">Frunk (L)</div>
          </div>
        )}
        <div className="rounded-lg border p-3 text-center">
          <div className="text-xl font-bold">{maxLoad}</div>
          <div className="text-xs text-muted-foreground">Charge max (kg)</div>
        </div>
      </div>

      {/* Seats-down toggle */}
      {cargoData.trunk_volume_max_liters && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={seatsDown}
            onChange={(e) => setSeatsDown(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <span className="text-sm font-medium">Si\u00e8ges arri\u00e8re rabattus</span>
          {seatsDown && (
            <Badge variant="secondary" className="text-xs">
              {cargoData.trunk_volume_max_liters} L
            </Badge>
          )}
        </label>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Item browser */}
        <Card>
          <CardContent className="p-4">
            <Tabs defaultValue="baby">
              <TabsList className="w-full flex-wrap h-auto gap-1">
                {Object.entries(CARGO_CATEGORIES).map(([key, cat]) => (
                  <TabsTrigger key={key} value={key} className="text-xs">
                    {cat.icon} {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.keys(CARGO_CATEGORIES).map((catKey) => (
                <TabsContent key={catKey} value={catKey} className="mt-3 space-y-1.5">
                  {PRESET_CARGO_ITEMS.filter((item) => item.category === catKey).map((item) => {
                    const inLoad = load.find((l) => l.item.id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => addItem(item)}
                        className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition hover:border-primary/50 hover:bg-accent/50"
                      >
                        <span className="text-xl shrink-0">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name_fr}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.volume_liters} L &middot; {item.weight_kg} kg
                            &middot; {item.length_cm}\u00d7{item.width_cm}\u00d7{item.height_cm} cm
                          </p>
                        </div>
                        {inLoad ? (
                          <Badge variant="secondary" className="text-xs">
                            \u00d7{inLoad.quantity}
                          </Badge>
                        ) : (
                          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Load summary */}
        <div className="space-y-4">
          {/* Current load */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-semibold">
                  Chargement ({totalItems} objet{totalItems !== 1 ? "s" : ""})
                </h4>
                {hasLoad && (
                  <Button variant="ghost" size="sm" onClick={clearAll}>
                    Vider
                  </Button>
                )}
              </div>

              {!hasLoad ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Ajoutez des objets depuis la liste
                </p>
              ) : (
                <div className="space-y-2">
                  {load.map((l) => (
                    <div
                      key={l.item.id}
                      className="flex items-center gap-2 rounded-lg border p-2"
                    >
                      <span className="text-lg">{l.item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{l.item.name_fr}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.item.volume_liters * l.quantity} L &middot; {l.item.weight_kg * l.quantity} kg
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => changeQuantity(l.item.id, -1)}
                          className="rounded p-1 hover:bg-accent"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-medium">{l.quantity}</span>
                        <button
                          onClick={() => changeQuantity(l.item.id, 1)}
                          className="rounded p-1 hover:bg-accent"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeItem(l.item.id)}
                          className="rounded p-1 hover:bg-red-500/20 ml-1"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Volume gauge */}
          {availableVolume > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Volume utilis\u00e9</span>
                <span className={fits ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {usedVolume} L / {availableVolume} L
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={`h-full rounded-full ${
                    fillPct <= 70
                      ? "bg-green-500"
                      : fillPct <= 90
                        ? "bg-yellow-500"
                        : fits
                          ? "bg-orange-500"
                          : "bg-red-500"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${fillPct}%` }}
                  transition={{ type: "spring", damping: 15 }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Poids : {totalWeight} kg / {maxLoad} kg</span>
                <span>
                  {fits
                    ? `${availableVolume - usedVolume} L restants`
                    : `${usedVolume - availableVolume} L de trop`}
                </span>
              </div>
            </div>
          )}

          {/* Result banner */}
          <AnimatePresence>
            {hasLoad && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`rounded-lg border p-4 ${
                  allOk
                    ? "border-green-500/30 bg-green-500/10"
                    : hasWarnings
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-red-500/30 bg-red-500/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  {allOk ? (
                    <>
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="font-medium text-green-600 dark:text-green-400">
                        Tout rentre !
                      </span>
                    </>
                  ) : fits ? (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        Attention
                      </span>
                    </>
                  ) : (
                    <>
                      <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <span className="font-medium text-red-600 dark:text-red-400">
                        \u00c7a ne rentre pas
                      </span>
                    </>
                  )}
                </div>
                {warnings.length > 0 && (
                  <ul className="mt-2 ml-7 space-y-1 text-sm text-muted-foreground">
                    {warnings.map((w, i) => (
                      <li key={i}>&bull; {w}</li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
