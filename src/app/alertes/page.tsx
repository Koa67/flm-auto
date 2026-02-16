import { createAuthServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteAlertButton } from "@/components/delete-alert-button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mes alertes prix",
  robots: "noindex",
};

export default async function AlertesPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/alertes");

  const { data: alerts } = await supabase
    .from("price_alerts")
    .select(
      `id, target_price_eur, alert_type, is_active, created_at,
       generations!inner(id, name, internal_code, slug, models!inner(name, slug, brands!inner(name, slug)))`
    )
    .eq("email", user.email!)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-amber-500" />
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          Mes alertes prix
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Recevez une notification quand le prix d&apos;un v&eacute;hicule
        baisse.
      </p>

      <div className="mt-8 space-y-3">
        {alerts && alerts.length > 0 ? (
          alerts.map((alert: any) => {
            const gen = alert.generations;
            const model = gen?.models;
            const brand = model?.brands;
            const label = `${brand?.name} ${model?.name} ${gen?.internal_code || gen?.name}`;
            const href = `/marques/${brand?.slug}/${model?.slug}/${gen?.slug}`;
            return (
              <Card key={alert.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1">
                    <Link
                      href={href}
                      className="font-medium text-white hover:text-primary"
                    >
                      {label}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {alert.alert_type === "price_drop"
                        ? "Baisse de prix"
                        : "Seuil"}
                      {alert.target_price_eur &&
                        ` · Cible : ${alert.target_price_eur.toLocaleString("fr-FR")} \u20ac`}
                    </p>
                  </div>
                  <DeleteAlertButton alertId={alert.id} />
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-16 text-center">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 font-semibold">Aucune alerte active</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajoutez une alerte depuis la fiche d&apos;un v&eacute;hicule.
            </p>
            <Link href="/recherche">
              <Button variant="outline" className="mt-4">
                Rechercher un v&eacute;hicule
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
