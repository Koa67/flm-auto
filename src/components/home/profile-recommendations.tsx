"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProfileStore } from "@/lib/profile-store";
import { getRecommendations } from "@/lib/recommendations";
import { UserCheck, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ProfileRecommendations() {
  const profile = useProfileStore((s) => s.profile);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || !profile.completed) return null;

  const recs = getRecommendations(profile);

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-semibold">Pour vous</h2>
          <Badge variant="secondary" className="text-[10px]">Profil actif</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {recs.map((rec) => (
            <Link key={rec.href} href={rec.href}>
              <Card className="card-hover group h-full">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="flex-1 text-sm font-medium">{rec.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        <div className="mt-3 text-center">
          <Link href="/profil">
            <Button variant="link" size="sm" className="text-xs text-muted-foreground">
              Modifier mon profil
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
