import type { Metadata } from "next";
import { WishlistGrid } from "@/components/wishlist/wishlist-grid";

export const metadata: Metadata = {
  title: "Mes Favoris",
  description:
    "Retrouvez tous les vehicules que vous avez ajoutes a votre liste de favoris sur FLM Auto.",
  robots: "noindex",
};

export default function FavorisPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Mes Favoris</h1>
      <p className="mt-1 text-muted-foreground">
        Les vehicules que vous avez mis de cote pour y revenir plus tard.
      </p>
      <div className="mt-8">
        <WishlistGrid />
      </div>
    </div>
  );
}
