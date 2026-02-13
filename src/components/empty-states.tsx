"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Search,
  GitCompareArrows,
  Camera,
  Video,
  Shield,
  Car,
  Baby,
  Package,
} from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: { label: string; href: string };
}

function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && (
        <Link href={action.href} className="mt-4">
          <Button variant="outline">{action.label}</Button>
        </Link>
      )}
    </div>
  );
}

export function EmptySearch({ query }: { query?: string }) {
  return (
    <EmptyState
      icon={<Search className="h-10 w-10 text-muted-foreground" />}
      title={query ? `Rien pour \u00ab ${query} \u00bb` : "Cherchez un v\u00e9hicule"}
      description={
        query
          ? "V\u00e9rifiez l\u2019orthographe ou essayez un code ch\u00e2ssis (E46, W204, 997\u2026)"
          : "Tapez un nom de marque, mod\u00e8le ou code g\u00e9n\u00e9ration pour commencer."
      }
      action={{ label: "Voir toutes les marques", href: "/marques" }}
    />
  );
}

export function EmptyCompare() {
  return (
    <EmptyState
      icon={<GitCompareArrows className="h-10 w-10 text-muted-foreground" />}
      title="Le ring est vide"
      description="Ajoutez au moins 2 v\u00e9hicules pour lancer le combat. BMW vs Mercedes ? Vous d\u00e9cidez."
      action={{ label: "Explorer les marques", href: "/marques" }}
    />
  );
}

export function EmptyPhotos() {
  return (
    <EmptyState
      icon={<Camera className="h-10 w-10 text-muted-foreground" />}
      title="Pas de photos"
      description="Ce v\u00e9hicule est plus discret qu\u2019une Dacia dans un parking de concession BMW."
      action={{ label: "Rechercher un autre v\u00e9hicule", href: "/recherche" }}
    />
  );
}

export function EmptyVideos() {
  return (
    <EmptyState
      icon={<Video className="h-10 w-10 text-muted-foreground" />}
      title="Pas de vid\u00e9os"
      description="Aucun YouTubeur n\u2019a encore d\u00e9couvert ce mod\u00e8le. Ou bien il est trop rapide pour \u00eatre film\u00e9."
    />
  );
}

export function EmptySafety() {
  return (
    <EmptyState
      icon={<Shield className="h-10 w-10 text-muted-foreground" />}
      title="Pas de donn\u00e9es Euro NCAP"
      description="Euro NCAP n\u2019a pas encore crash-test\u00e9 ce v\u00e9hicule. Il reste intact\u2026 pour l\u2019instant."
    />
  );
}

export function EmptyVariants() {
  return (
    <EmptyState
      icon={<Car className="h-10 w-10 text-muted-foreground" />}
      title="Aucune motorisation"
      description="Les donn\u00e9es techniques de ce mod\u00e8le jouent \u00e0 cache-cache. On les cherche."
      action={{ label: "Explorer les marques", href: "/marques" }}
    />
  );
}

export function EmptyFamilyFit() {
  return (
    <EmptyState
      icon={<Baby className="h-10 w-10 text-muted-foreground" />}
      title="Pas de donn\u00e9es Family Fit"
      description="On n\u2019a pas encore install\u00e9 3 si\u00e8ges-auto dans ce mod\u00e8le. \u00c7a viendra."
      action={{ label: "Voir le classement Family Fit", href: "/family-fit" }}
    />
  );
}

export function EmptyCargo() {
  return (
    <EmptyState
      icon={<Package className="h-10 w-10 text-muted-foreground" />}
      title="Pas de donn\u00e9es coffre"
      description="Le volume du coffre de ce mod\u00e8le est encore un myst\u00e8re. M\u00eame pour nous."
      action={{ label: "Calculateur de coffre", href: "/coffre" }}
    />
  );
}
