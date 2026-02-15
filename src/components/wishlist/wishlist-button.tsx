"use client";

import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useFavorites } from "@/hooks/use-favorites";
import { useGamificationStore } from "@/lib/gamification-store";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  generationId: string;
  className?: string;
}

export function WishlistButton({ generationId, className }: WishlistButtonProps) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(generationId);

  const handleClick = () => {
    const willAdd = !active;
    toggle(generationId);

    // Fire-and-forget server sync
    if (willAdd) {
      useGamificationStore.getState().incrementStat("favoritesAdded");
      fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generation_id: generationId }),
      }).catch(() => {});
    } else {
      fetch("/api/wishlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generation_id: generationId }),
      }).catch(() => {});
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={{ scale: 0.8 }}
      whileHover={{ scale: 1.1 }}
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={cn(
        "inline-flex items-center justify-center rounded-full p-2 transition-colors",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-colors",
          active
            ? "fill-red-500 text-red-500"
            : "text-muted-foreground"
        )}
      />
    </motion.button>
  );
}
