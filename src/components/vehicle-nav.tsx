import Link from "next/link";
import { cn } from "@/lib/utils";

const subPages = [
  { slug: "fiche-technique", label: "Fiche technique" },
  { slug: "dimensions", label: "Dimensions" },
  { slug: "securite", label: "Sécurité" },
  { slug: "photos", label: "Photos" },
  { slug: "videos", label: "Vidéos" },
  { slug: "alternatives", label: "Alternatives" },
];

export function VehicleNav({
  basePath,
  active,
}: {
  basePath: string;
  active?: string;
}) {
  return (
    <nav className="flex flex-wrap gap-2">
      <Link
        href={basePath}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
          !active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
        )}
      >
        Aperçu
      </Link>
      {subPages.map((page) => (
        <Link
          key={page.slug}
          href={`${basePath}/${page.slug}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
            active === page.slug
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground"
          )}
        >
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
