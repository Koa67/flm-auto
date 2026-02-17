"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bell, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

interface PriceAlertButtonProps {
  generationId: string;
  vehicleName: string;
}

export function PriceAlertButton({
  generationId,
  vehicleName,
}: PriceAlertButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleClick = async () => {
    if (!user) {
      router.push(`/connexion?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generation_id: generationId,
          alert_type: "price_drop",
        }),
      });

      if (res.ok) {
        setDone(true);
        toast.success("Alerte créée !", {
          description: `Vous serez notifié pour la ${vehicleName}`,
        });
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la création");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Check className="h-4 w-4 text-green-500" />
        Alerte active
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      Alerte prix
    </Button>
  );
}
