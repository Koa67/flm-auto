"use client";

import { useState, useEffect } from "react";
import { GitCompareArrows, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompareStore } from "@/stores/compare-store";

interface QuickActionsProps {
  generationId: string;
  vehicleName: string;
  thumbnail: string | null;
}

export function CompareQuickAction({ generationId, vehicleName, thumbnail }: QuickActionsProps) {
  const addVehicle = useCompareStore((s) => s.addVehicle);
  const vehicles = useCompareStore((s) => s.vehicles);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const isAdded = vehicles.some((v) => v.id === generationId);
  const isFull = vehicles.length >= 4;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isAdded || isFull}
      onClick={() =>
        addVehicle({
          id: generationId,
          name: vehicleName,
          image: thumbnail || undefined,
        })
      }
      className="gap-1.5"
    >
      {isAdded ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Ajouté au comparateur
        </>
      ) : (
        <>
          <GitCompareArrows className="h-3.5 w-3.5" />
          Comparer
        </>
      )}
    </Button>
  );
}
