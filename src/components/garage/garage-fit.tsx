"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Warehouse, Check, X, AlertTriangle } from "lucide-react";

interface VehicleDimensions {
  length_mm: number | null;
  width_mm: number | null;
  width_mirrors_mm: number | null;
  height_mm: number | null;
}

interface GarageFitProps {
  generationId: string;
  vehicleName: string;
  dimensions?: VehicleDimensions;
}

interface GarageDims {
  length: number; // cm
  width: number; // cm
  height: number; // cm
}

type FitStatus = "good" | "tight" | "no";

function getFitStatus(vehicleCm: number, garageCm: number): FitStatus {
  const clearance = garageCm - vehicleCm;
  if (clearance < 0) return "no";
  if (clearance < 20) return "tight";
  return "good";
}

function FitIndicator({ status, label, vehicleCm, garageCm }: {
  status: FitStatus;
  label: string;
  vehicleCm: number;
  garageCm: number;
}) {
  const clearance = garageCm - vehicleCm;
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-2">
        {status === "good" && <Check className="h-5 w-5 text-green-500" />}
        {status === "tight" && <AlertTriangle className="h-5 w-5 text-amber-500" />}
        {status === "no" && <X className="h-5 w-5 text-red-500" />}
        <span className="font-medium">{label}</span>
      </div>
      <div className="text-right text-sm">
        <div className="text-muted-foreground">
          {vehicleCm} cm / {garageCm} cm
        </div>
        <div
          className={
            status === "good"
              ? "text-green-500"
              : status === "tight"
                ? "text-amber-500"
                : "text-red-500"
          }
        >
          {clearance >= 0 ? `+${clearance} cm` : `${clearance} cm`}
        </div>
      </div>
    </div>
  );
}

export function GarageFit({ generationId, vehicleName, dimensions }: GarageFitProps) {
  const [garage, setGarage] = useState<GarageDims>({ length: 500, width: 250, height: 200 });
  const [vehicleDims, setVehicleDims] = useState<VehicleDimensions | null>(dimensions || null);
  const [loading, setLoading] = useState(!dimensions);

  useEffect(() => {
    if (dimensions) return;

    async function fetchDimensions() {
      try {
        const res = await fetch(`/api/dimensions?generation_id=${generationId}`);
        if (res.ok) {
          const data = await res.json();
          setVehicleDims(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchDimensions();
  }, [generationId, dimensions]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/2 rounded bg-muted" />
            <div className="h-20 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!vehicleDims || (!vehicleDims.length_mm && !vehicleDims.width_mm && !vehicleDims.height_mm)) {
    return null; // Don't render if no dimension data
  }

  const vehicleLength = vehicleDims.length_mm ? Math.round(vehicleDims.length_mm / 10) : null;
  const vehicleWidth = vehicleDims.width_mirrors_mm
    ? Math.round(vehicleDims.width_mirrors_mm / 10)
    : vehicleDims.width_mm
      ? Math.round(vehicleDims.width_mm / 10)
      : null;
  const vehicleHeight = vehicleDims.height_mm ? Math.round(vehicleDims.height_mm / 10) : null;

  const lengthFit = vehicleLength ? getFitStatus(vehicleLength, garage.length) : null;
  const widthFit = vehicleWidth ? getFitStatus(vehicleWidth, garage.width) : null;
  const heightFit = vehicleHeight ? getFitStatus(vehicleHeight, garage.height) : null;

  const allFit =
    (lengthFit === "good" || lengthFit === "tight" || lengthFit === null) &&
    (widthFit === "good" || widthFit === "tight" || widthFit === null) &&
    (heightFit === "good" || heightFit === "tight" || heightFit === null);
  const anyNo = lengthFit === "no" || widthFit === "no" || heightFit === "no";
  const anyTight = lengthFit === "tight" || widthFit === "tight" || heightFit === "tight";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Warehouse className="h-5 w-5" />
          Mon garage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Garage dimensions inputs */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Longueur (cm)</label>
            <Slider
              value={[garage.length]}
              onValueChange={([v]) => setGarage((g) => ({ ...g, length: v }))}
              min={300}
              max={800}
              step={10}
              className="mt-2"
            />
            <div className="mt-1 text-center text-sm text-muted-foreground">
              {garage.length} cm
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Largeur (cm)</label>
            <Slider
              value={[garage.width]}
              onValueChange={([v]) => setGarage((g) => ({ ...g, width: v }))}
              min={200}
              max={500}
              step={10}
              className="mt-2"
            />
            <div className="mt-1 text-center text-sm text-muted-foreground">
              {garage.width} cm
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Hauteur (cm)</label>
            <Slider
              value={[garage.height]}
              onValueChange={([v]) => setGarage((g) => ({ ...g, height: v }))}
              min={150}
              max={350}
              step={10}
              className="mt-2"
            />
            <div className="mt-1 text-center text-sm text-muted-foreground">
              {garage.height} cm
            </div>
          </div>
        </div>

        {/* Result banner */}
        <div
          className={`rounded-lg p-4 text-center font-medium ${
            anyNo
              ? "bg-red-500/10 text-red-500"
              : anyTight
                ? "bg-amber-500/10 text-amber-500"
                : "bg-green-500/10 text-green-500"
          }`}
        >
          {anyNo
            ? `La ${vehicleName} ne rentre pas dans votre garage`
            : anyTight
              ? `La ${vehicleName} rentre, mais c'est serré`
              : `La ${vehicleName} rentre dans votre garage`}
        </div>

        {/* Per-dimension breakdown */}
        <div className="space-y-2">
          {vehicleLength && lengthFit && (
            <FitIndicator
              status={lengthFit}
              label="Longueur"
              vehicleCm={vehicleLength}
              garageCm={garage.length}
            />
          )}
          {vehicleWidth && widthFit && (
            <FitIndicator
              status={widthFit}
              label="Largeur (rétros)"
              vehicleCm={vehicleWidth}
              garageCm={garage.width}
            />
          )}
          {vehicleHeight && heightFit && (
            <FitIndicator
              status={heightFit}
              label="Hauteur"
              vehicleCm={vehicleHeight}
              garageCm={garage.height}
            />
          )}
        </div>

        {anyTight && (
          <p className="text-sm text-muted-foreground">
            Les marges inférieures à 20 cm rendent le stationnement et
            l&apos;ouverture des portes difficiles.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
