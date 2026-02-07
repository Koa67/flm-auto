"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  generationId,
  size = "icon",
}: {
  generationId: string;
  size?: "icon" | "default";
}) {
  const { toggle, isFavorite } = useFavorites();
  const active = isFavorite(generationId);

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(generationId);
      }}
      className={cn(
        "transition-colors",
        active && "text-red-500 hover:text-red-600"
      )}
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      <Heart
        className={cn("h-4 w-4", active && "fill-current")}
      />
      {size === "default" && (
        <span className="ml-2">
          {active ? "Favori" : "Ajouter aux favoris"}
        </span>
      )}
    </Button>
  );
}
