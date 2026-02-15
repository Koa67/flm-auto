import { createAuthServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Heart, GitCompareArrows, Search, Bell, Settings, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tableau de bord",
  robots: "noindex",
};

export default async function DashboardPage() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  // Get user profile
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  // Get counts in parallel
  const [favResult, compResult, searchResult, alertResult] = await Promise.all([
    supabase.from("wishlists").select("id", { count: "exact", head: true }).eq("auth_user_id", user.id),
    supabase.from("saved_comparisons").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("saved_searches").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("price_alerts").select("id", { count: "exact", head: true }).eq("auth_user_id", user.id),
  ]);

  const stats = [
    { label: "Favoris", count: favResult.count || 0, icon: Heart, href: "/favoris", color: "text-red-500" },
    { label: "Comparaisons", count: compResult.count || 0, icon: GitCompareArrows, href: "/dashboard#comparisons", color: "text-blue-500" },
    { label: "Recherches", count: searchResult.count || 0, icon: Search, href: "/dashboard#searches", color: "text-green-500" },
    { label: "Alertes", count: alertResult.count || 0, icon: Bell, href: "/alertes", color: "text-amber-500" },
  ];

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Utilisateur";

  // Get recent saved comparisons
  const { data: savedComparisons } = await supabase
    .from("saved_comparisons")
    .select("id, name, generation_ids, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Get recent saved searches
  const { data: savedSearches } = await supabase
    .from("saved_searches")
    .select("id, name, query, filters, result_count, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bonjour, {displayName}</h1>
          <p className="mt-1 text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/settings">
            <Settings className="mr-2 h-4 w-4" />
            Paramètres
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-colors hover:bg-accent">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  <span className="text-2xl font-bold">{stat.count}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Saved Comparisons */}
      <section id="comparisons" className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Comparaisons sauvegardées</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/comparer">
              Nouvelle comparaison
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        {savedComparisons && savedComparisons.length > 0 ? (
          <div className="mt-4 space-y-2">
            {savedComparisons.map((comp) => (
              <Card key={comp.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{comp.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {comp.generation_ids.length} véhicules · {new Date(comp.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/comparer?ids=${comp.generation_ids.join(",")}`}>
                      Charger
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4">
            <CardContent className="p-6 text-center text-muted-foreground">
              <GitCompareArrows className="mx-auto h-8 w-8 opacity-30" />
              <p className="mt-2">Aucune comparaison sauvegardée</p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/comparer">Comparer des véhicules</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Saved Searches */}
      <section id="searches" className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recherches sauvegardées</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/recherche">
              Nouvelle recherche
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        {savedSearches && savedSearches.length > 0 ? (
          <div className="mt-4 space-y-2">
            {savedSearches.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">
                      « {s.query} » · {s.result_count} résultats · {new Date(s.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/recherche?q=${encodeURIComponent(s.query)}`}>
                      Relancer
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4">
            <CardContent className="p-6 text-center text-muted-foreground">
              <Search className="mx-auto h-8 w-8 opacity-30" />
              <p className="mt-2">Aucune recherche sauvegardée</p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/recherche">Lancer une recherche</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
