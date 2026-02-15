import { notFound } from "next/navigation";
import { createStaticClient } from "@/lib/supabase/server";
import { getGenerationBySlug, genLabel } from "@/lib/vehicle-helpers";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { VehicleNav } from "@/components/vehicle-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertTriangle, Wrench, TrendingDown } from "lucide-react";
import { ENGINE_RED_FLAGS } from "@/types/vehicle";
import { ViewTracker } from "@/components/view-tracker";
import type { Metadata } from "next";

export const revalidate = 3600;

interface Props {
  params: Promise<{ brand: string; model: string; generation: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) return {};
  const label = genLabel(v.generation);
  return {
    title: `Fiabilité ${v.brand.name} ${v.model.name} ${label}`,
    description: `Fiabilité ${v.brand.name} ${v.model.name} ${label} : problèmes connus, taux de panne TÜV, rappels constructeur, alertes moteur.`,
    alternates: { canonical: `/marques/${bs}/${ms}/${gs}/fiabilite` },
  };
}

interface TUVData {
  age: string;
  defect_rate: number;
  rank: number;
  defects: string;
}

async function getReliabilityData(generationId: string, engineCodes: string[]) {
  const db = createStaticClient();

  // Wrap with Promise.resolve() because Supabase returns PromiseLike (no .catch)
  const reliabilityPromise = Promise.resolve(
    db.from("reliability_issues").select("*").eq("generation_id", generationId).order("severity")
  ).then(r => r.data ?? []).catch(() => [] as any[]);

  const tuvPromise = Promise.resolve(
    db.from("third_party_specs").select("spec_type, spec_value, raw_data").eq("generation_id", generationId).like("spec_type", "tuv_%")
  ).then(r => r.data ?? []).catch(() => [] as any[]);

  const recallPromise = Promise.resolve(
    db.from("vehicle_recalls").select("id", { count: "exact", head: true }).eq("generation_id", generationId)
  ).then(r => r.count || 0).catch(() => 0);

  const variantPromise = Promise.resolve(
    db.from("engine_variants").select("engine_code, name, fuel_type").eq("generation_id", generationId).limit(30)
  ).then(r => r.data ?? []).catch(() => [] as any[]);

  const [reliabilityIssues, tuvSpecs, recallCount, variants] = await Promise.all([
    reliabilityPromise,
    tuvPromise,
    recallPromise,
    variantPromise,
  ]);

  // Parse TÜV data into structured format
  const tuvEntries: TUVData[] = [];
  const tuvByAge = new Map<string, Partial<TUVData>>();

  for (const spec of tuvSpecs || []) {
    const match = spec.spec_type.match(/^tuv_(defect_rate|rank|defects)_(\d+_\d+)yr$/);
    if (!match) continue;
    const [, field, age] = match;
    const ageLabel = age.replace("_", "-");
    if (!tuvByAge.has(ageLabel)) tuvByAge.set(ageLabel, { age: ageLabel });
    const entry = tuvByAge.get(ageLabel)!;
    if (field === "defect_rate") entry.defect_rate = parseFloat(spec.spec_value);
    if (field === "rank") entry.rank = parseInt(spec.spec_value);
    if (field === "defects") entry.defects = spec.spec_value;
  }
  for (const [, entry] of tuvByAge) {
    if (entry.defect_rate != null) tuvEntries.push(entry as TUVData);
  }
  tuvEntries.sort((a, b) => {
    const ageA = parseInt(a.age.split("-")[0]);
    const ageB = parseInt(b.age.split("-")[0]);
    return ageA - ageB;
  });

  // Match engine red flags from static data
  const allCodes = [
    ...(engineCodes || []),
    ...(variants || []).map((v: any) => v.engine_code).filter(Boolean),
  ];
  const matchedFlags: Array<{
    key: string;
    flag: (typeof ENGINE_RED_FLAGS)[string];
  }> = [];
  const seenFlags = new Set<string>();

  for (const code of allCodes) {
    for (const [key, flag] of Object.entries(ENGINE_RED_FLAGS)) {
      if (seenFlags.has(key)) continue;
      if (flag.patterns.some((p) => code.toUpperCase().includes(p.toUpperCase()))) {
        matchedFlags.push({ key, flag });
        seenFlags.add(key);
      }
    }
  }

  return {
    reliabilityIssues: reliabilityIssues || [],
    tuvData: tuvEntries,
    recallCount: recallCount || 0,
    matchedFlags,
    engineCodes: allCodes.filter(Boolean),
  };
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  major: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  moderate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  minor: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critique",
  major: "Majeur",
  moderate: "Modéré",
  minor: "Mineur",
};

function defectRateColor(rate: number): string {
  if (rate <= 5) return "bar-perf-excellent";
  if (rate <= 10) return "bar-perf-good";
  if (rate <= 15) return "bar-perf-average";
  return "bar-perf-poor";
}

function defectRateLabel(rate: number): string {
  if (rate <= 5) return "Excellent";
  if (rate <= 10) return "Bon";
  if (rate <= 15) return "Moyen";
  return "Médiocre";
}

export default async function FiabilitePage({ params }: Props) {
  const { brand: bs, model: ms, generation: gs } = await params;
  const v = await getGenerationBySlug(bs, ms, gs);
  if (!v) notFound();

  const label = genLabel(v.generation);
  const basePath = `/marques/${bs}/${ms}/${gs}`;

  const { reliabilityIssues, tuvData, recallCount, matchedFlags, engineCodes } =
    await getReliabilityData(v.generation.id, []);

  // Compute reliability score (0-100)
  let reliabilityScore = 80; // Base score
  for (const flag of matchedFlags) {
    if (flag.flag.severity === "critical") reliabilityScore -= 15;
    else if (flag.flag.severity === "major") reliabilityScore -= 8;
    else if (flag.flag.severity === "moderate") reliabilityScore -= 4;
  }
  for (const issue of reliabilityIssues) {
    if (issue.severity === "critical") reliabilityScore -= 10;
    else if (issue.severity === "major") reliabilityScore -= 5;
    else reliabilityScore -= 2;
  }
  // TÜV bonus/penalty
  if (tuvData.length > 0) {
    const avgDefect = tuvData.reduce((s, t) => s + t.defect_rate, 0) / tuvData.length;
    if (avgDefect <= 5) reliabilityScore += 10;
    else if (avgDefect <= 10) reliabilityScore += 5;
    else if (avgDefect > 20) reliabilityScore -= 10;
  }
  reliabilityScore = Math.max(10, Math.min(100, reliabilityScore));

  const scoreTier =
    reliabilityScore >= 80 ? "excellent" : reliabilityScore >= 60 ? "good" : reliabilityScore >= 40 ? "average" : "poor";

  const hasData = matchedFlags.length > 0 || tuvData.length > 0 || reliabilityIssues.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <ViewTracker statKey="fiabiliteViewed" />
      <Breadcrumbs
        items={[
          { label: "Marques", href: "/marques" },
          { label: v.brand.name, href: `/marques/${bs}` },
          { label: v.model.name, href: `/marques/${bs}/${ms}` },
          { label: label, href: basePath },
          { label: "Fiabilité" },
        ]}
      />

      <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
        Fiabilité <span className="text-primary">{v.brand.name} {v.model.name}</span> {label}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Problèmes connus, taux de panne TÜV, alertes moteur et rappels constructeur.
      </p>

      <div className="mt-6">
        <VehicleNav basePath={basePath} active="fiabilite" />
      </div>

      {/* Reliability Score */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Score de fiabilité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-mono text-4xl font-bold text-white">{reliabilityScore}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">/ 100</div>
              </div>
              <div className="flex-1">
                <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                  <div
                    className={`h-full rounded-full bar-perf-${scoreTier}`}
                    style={{ width: `${reliabilityScore}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{matchedFlags.length} alerte{matchedFlags.length !== 1 ? "s" : ""} moteur</span>
                  <span>{recallCount} rappel{recallCount !== 1 ? "s" : ""}</span>
                  {tuvData.length > 0 && <span>TÜV disponible</span>}
                </div>
              </div>
            </div>
            {!hasData && (
              <p className="mt-4 text-sm text-muted-foreground">
                Aucune donnée de fiabilité spécifique disponible pour ce modèle. Le score est basé sur la moyenne du segment.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* TÜV Defect Rates */}
      {tuvData.length > 0 && (
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-blue-400" />
                Taux de panne TÜV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Taux de défauts constatés au contrôle technique TÜV (Allemagne) par tranche d&apos;âge.
              </p>
              <div className="space-y-4">
                {tuvData.map((t) => (
                  <div key={t.age}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t.age} ans</span>
                      <div className="flex items-center gap-2">
                        <span className="text-mono font-bold text-white">{t.defect_rate}%</span>
                        <Badge variant="outline" className="text-[10px]">
                          {defectRateLabel(t.defect_rate)}
                        </Badge>
                        {t.rank && (
                          <span className="text-[10px] text-muted-foreground">
                            #{t.rank}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                      <div
                        className={`h-full rounded-full ${defectRateColor(t.defect_rate)}`}
                        style={{ width: `${Math.min(t.defect_rate * 3, 100)}%` }}
                      />
                    </div>
                    {t.defects && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Défauts fréquents : {t.defects}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Engine Red Flags */}
      {matchedFlags.length > 0 && (
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                Alertes moteur ({matchedFlags.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {matchedFlags.map(({ key, flag }) => (
                <div
                  key={key}
                  className={`rounded-lg border p-4 ${SEVERITY_COLORS[flag.severity]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={SEVERITY_COLORS[flag.severity]}>
                          {SEVERITY_LABELS[flag.severity]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{flag.engine_family}</span>
                      </div>
                      <h3 className="font-semibold text-white">{flag.title_fr}</h3>
                      <p className="mt-1 text-sm opacity-90">{flag.description_fr}</p>
                    </div>
                  </div>

                  {flag.symptoms_fr.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-medium uppercase tracking-wider opacity-70 mb-1">
                        Symptômes
                      </div>
                      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {flag.symptoms_fr.map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-sm">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-4 text-xs opacity-80">
                    {flag.affected_years && (
                      <span>Années : {flag.affected_years}</span>
                    )}
                    {flag.repair_cost_range && (
                      <span>Coût réparation : {flag.repair_cost_range}</span>
                    )}
                    {flag.source && (
                      <span>Source : {flag.source}</span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* DB Reliability Issues */}
      {reliabilityIssues.length > 0 && (
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-yellow-400" />
                Problèmes connus ({reliabilityIssues.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reliabilityIssues.map((issue: any) => (
                <div
                  key={issue.id}
                  className="rounded-lg border border-[var(--border-subtle)] surface-3 p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={SEVERITY_COLORS[issue.severity] || ""}>
                      {SEVERITY_LABELS[issue.severity] || issue.severity}
                    </Badge>
                    {issue.engine_code && (
                      <span className="text-mono text-xs text-muted-foreground">{issue.engine_code}</span>
                    )}
                  </div>
                  <h4 className="font-medium text-white">{issue.title_fr || issue.title}</h4>
                  {issue.description_fr && (
                    <p className="mt-1 text-sm text-muted-foreground">{issue.description_fr}</p>
                  )}
                  {issue.symptoms_fr && issue.symptoms_fr.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {issue.symptoms_fr.map((s: string, i: number) => (
                        <span key={i} className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    {issue.affected_km_min != null && (
                      <span>
                        {issue.affected_km_min.toLocaleString("fr-FR")}–{issue.affected_km_max?.toLocaleString("fr-FR")} km
                      </span>
                    )}
                    {issue.repair_cost_eur_min != null && (
                      <span>
                        {issue.repair_cost_eur_min}–{issue.repair_cost_eur_max} €
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recalls CTA */}
      {recallCount > 0 && (
        <div className="mt-6 surface-3 rounded-xl border border-[var(--border-subtle)] p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg surface-2">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">{recallCount} rappel{recallCount !== 1 ? "s" : ""} constructeur</p>
              <p className="text-sm text-muted-foreground">
                Consultez les détails dans l&apos;onglet Sécurité
              </p>
            </div>
            <a
              href={`${basePath}/securite`}
              className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
            >
              Voir les rappels
            </a>
          </div>
        </div>
      )}

      {/* No data state */}
      {!hasData && recallCount === 0 && (
        <div className="mt-8 text-center">
          <Shield className="mx-auto h-16 w-16 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-semibold text-white">
            Pas de problème connu
          </h3>
          <p className="mt-2 max-w-md mx-auto text-muted-foreground">
            Aucune alerte de fiabilité n&apos;a été trouvée pour ce modèle dans notre base de données.
            Cela ne signifie pas l&apos;absence totale de problèmes.
          </p>
        </div>
      )}
    </div>
  );
}
