/**
 * 46-real-data-gaps.ts — Identify REAL data gaps
 *
 * READ-ONLY. Modifies nothing.
 *
 * 1. Gens with NO verified data (no A in any table)
 * 2. Per-brand tier breakdown (gold/silver/bronze/incomplete)
 * 3. Top 20 emptiest gens (scraping priorities)
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/46-real-data-gaps.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DATA_DIR = path.resolve(__dirname, '../../data');

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%';
  return (n / total * 100).toFixed(1) + '%';
}

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║  46-REAL-DATA-GAPS — What actually needs fixing                               ║');
  console.log('║  READ-ONLY. Modifies nothing.                                                ║');
  console.log('╚' + '═'.repeat(78) + '╝');

  console.log('\n  Loading data...');
  const gens = await paginateAll('generations', 'id, name, model:models(name, brand:brands(name))');
  const totalGens = gens.length;

  // Load confidence data
  const safety = await paginateAll('safety_ratings', 'generation_id, confidence');
  const dims = await paginateAll('interior_dimensions', 'generation_id, confidence');
  const fits = await paginateAll('family_fit_compatibility', 'generation_id, confidence');
  const specs = await paginateAll('third_party_specs', 'generation_id');

  // Photos + videos — gen-level confidence
  const photoConf = new Map<string, string>(); // gen_id → best confidence
  let photoPage = 0;
  while (true) {
    const { data, error } = await supabase.from('vehicle_images')
      .select('generation_id, confidence')
      .range(photoPage * 1000, (photoPage + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      const existing = photoConf.get(row.generation_id);
      if (!existing || row.confidence < existing) photoConf.set(row.generation_id, row.confidence);
    }
    if (data.length < 1000) break;
    photoPage++;
  }

  const videoConf = new Map<string, string>();
  let videoPage = 0;
  while (true) {
    const { data, error } = await supabase.from('vehicle_videos')
      .select('generation_id, confidence')
      .range(videoPage * 1000, (videoPage + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      const existing = videoConf.get(row.generation_id);
      if (!existing || row.confidence < existing) videoConf.set(row.generation_id, row.confidence);
    }
    if (data.length < 1000) break;
    videoPage++;
  }

  console.log(`  Loaded: ${totalGens} gens`);

  // Build maps
  const safetyConf = new Map<string, string>();
  for (const r of safety) safetyConf.set(r.generation_id, r.confidence || 'D');
  const dimsConf = new Map<string, string>();
  for (const r of dims) dimsConf.set(r.generation_id, r.confidence || 'D');
  const fitConf = new Map<string, string>();
  for (const r of fits) fitConf.set(r.generation_id, r.confidence || 'D');
  const specsSet = new Set(specs.map((r: any) => r.generation_id));

  // ── 1. Gens with NO verified data ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  1. GENS WITH NO VERIFIED DATA (no A/B anywhere)');
  console.log('═══════════════════════════════════════════════════════════════');

  const abSet = new Set(['A', 'B']);
  const noVerified: any[] = [];

  for (const gen of gens) {
    const hasVerifiedSafety = abSet.has(safetyConf.get(gen.id) || '');
    const hasVerifiedDims = abSet.has(dimsConf.get(gen.id) || '');
    const hasVerifiedFit = abSet.has(fitConf.get(gen.id) || '');
    const hasVerifiedPhoto = abSet.has(photoConf.get(gen.id) || '');
    const hasVerifiedVideo = abSet.has(videoConf.get(gen.id) || '');
    const hasSpecs = specsSet.has(gen.id);

    if (!hasVerifiedSafety && !hasVerifiedDims && !hasVerifiedFit &&
        !hasVerifiedPhoto && !hasVerifiedVideo && !hasSpecs) {
      const bn = (gen as any).model?.brand?.name || '?';
      const mn = (gen as any).model?.name || '?';
      noVerified.push({ id: gen.id, brand: bn, model: mn, gen: gen.name });
    }
  }

  console.log(`  Total gens with ZERO verified data: ${noVerified.length} / ${totalGens} (${pct(noVerified.length, totalGens)})`);
  if (noVerified.length > 0) {
    console.log('\n  By brand:');
    const byBrand: Record<string, number> = {};
    for (const g of noVerified) byBrand[g.brand] = (byBrand[g.brand] || 0) + 1;
    for (const [b, c] of Object.entries(byBrand).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${b.padEnd(18)} ${c}`);
    }
  }

  // ── 2. Per-brand tier breakdown ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  2. BRAND QUALITY TIERS');
  console.log('═══════════════════════════════════════════════════════════════');

  type GenTier = 'gold' | 'silver' | 'bronze' | 'incomplete';

  function getGenTier(genId: string): GenTier {
    const sc = safetyConf.get(genId) || '';
    const dc = dimsConf.get(genId) || '';
    const fc = fitConf.get(genId) || '';
    const pc = photoConf.get(genId) || '';
    const vc = videoConf.get(genId) || '';
    const hasSpecs = specsSet.has(genId);

    // Gold: safety A/B + dims A/B + photo A/B
    if (abSet.has(sc) && abSet.has(dc) && abSet.has(pc)) return 'gold';

    // Silver: safety A-C + dims A-C + some data
    const abcSet = new Set(['A', 'B', 'C']);
    if (abcSet.has(sc) && abcSet.has(dc)) return 'silver';

    // Bronze: at least has some data (specs + photo)
    if (hasSpecs && (pc === 'A' || pc === 'B')) return 'bronze';

    return 'incomplete';
  }

  const brandTiers: Record<string, Record<GenTier, number>> = {};
  for (const gen of gens) {
    const bn = (gen as any).model?.brand?.name || '?';
    if (!brandTiers[bn]) brandTiers[bn] = { gold: 0, silver: 0, bronze: 0, incomplete: 0 };
    const tier = getGenTier(gen.id);
    brandTiers[bn][tier]++;
  }

  console.log('  ' + 'Brand'.padEnd(16) + 'Total'.padStart(5) + '  Gold   Silver  Bronze  Incomplete');
  for (const [brand, tiers] of Object.entries(brandTiers).sort((a, b) => {
    const aTotal = Object.values(a[1]).reduce((x, y) => x + y, 0);
    const bTotal = Object.values(b[1]).reduce((x, y) => x + y, 0);
    return bTotal - aTotal;
  })) {
    const total = Object.values(tiers).reduce((a, b) => a + b, 0);
    console.log(`  ${brand.padEnd(16)} ${String(total).padStart(4)}  ${String(tiers.gold).padStart(5)}   ${String(tiers.silver).padStart(5)}   ${String(tiers.bronze).padStart(5)}   ${String(tiers.incomplete).padStart(5)}`);
  }

  // ── 3. Top 20 emptiest gens ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  3. TOP 20 EMPTIEST GENS (scraping priorities)');
  console.log('═══════════════════════════════════════════════════════════════');

  const genScores: { gen: any; score: number; details: string }[] = [];

  for (const gen of gens) {
    const bn = (gen as any).model?.brand?.name || '?';
    const mn = (gen as any).model?.name || '?';

    let score = 0;
    const parts: string[] = [];

    if (specsSet.has(gen.id)) { score += 1; parts.push('specs'); }
    const pc = photoConf.get(gen.id);
    if (pc && abSet.has(pc)) { score += 1; parts.push('photo'); }
    const sc = safetyConf.get(gen.id);
    if (sc && abSet.has(sc)) { score += 2; parts.push('safety'); }
    const dc = dimsConf.get(gen.id);
    if (dc && abSet.has(dc)) { score += 1; parts.push('dims'); }
    const fc = fitConf.get(gen.id);
    if (fc && abSet.has(fc)) { score += 1; parts.push('family'); }
    const vcc = videoConf.get(gen.id);
    if (vcc && abSet.has(vcc)) { score += 1; parts.push('video'); }

    genScores.push({
      gen: { brand: bn, model: mn, name: gen.name, id: gen.id },
      score,
      details: parts.length > 0 ? parts.join('+') : 'NOTHING',
    });
  }

  // Sort by score ascending (emptiest first), then by brand for readability
  genScores.sort((a, b) => a.score - b.score || a.gen.brand.localeCompare(b.gen.brand));

  console.log('  ' + 'Brand'.padEnd(16) + 'Model'.padEnd(20) + 'Gen'.padEnd(20) + 'Score  Has');
  for (const gs of genScores.slice(0, 30)) {
    console.log(`  ${gs.gen.brand.padEnd(16)} ${gs.gen.model.padEnd(20)} ${(gs.gen.name || '?').padEnd(20)} ${String(gs.score).padStart(3)}/7  ${gs.details}`);
  }

  // ── 4. What would move the needle most? ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  4. IMPACT ANALYSIS — What would move the needle?');
  console.log('═══════════════════════════════════════════════════════════════');

  // Count gens missing A/B by category
  let missingSafety = 0, missingDims = 0, missingPhotos = 0, missingVideos = 0, missingFit = 0;
  for (const gen of gens) {
    if (!abSet.has(safetyConf.get(gen.id) || '')) missingSafety++;
    if (!abSet.has(dimsConf.get(gen.id) || '')) missingDims++;
    if (!abSet.has(photoConf.get(gen.id) || '')) missingPhotos++;
    if (!abSet.has(videoConf.get(gen.id) || '')) missingVideos++;
    if (!abSet.has(fitConf.get(gen.id) || '')) missingFit++;
  }

  const impacts = [
    { label: 'Safety ×25', missing: missingSafety, weight: 25, gain: missingSafety / totalGens * 25 },
    { label: 'Dims ×15', missing: missingDims, weight: 15, gain: missingDims / totalGens * 15 },
    { label: 'Photos ×15', missing: missingPhotos, weight: 15, gain: missingPhotos / totalGens * 15 },
    { label: 'Videos ×15', missing: missingVideos, weight: 15, gain: missingVideos / totalGens * 15 },
    { label: 'Family ×15', missing: missingFit, weight: 15, gain: missingFit / totalGens * 15 },
  ];

  impacts.sort((a, b) => b.gain - a.gain);

  console.log('  If we filled ALL verified gaps:');
  console.log('  ' + 'Category'.padEnd(14) + 'Missing A/B'.padStart(12) + '  Max gain');
  for (const i of impacts) {
    console.log(`  ${i.label.padEnd(14)} ${String(i.missing).padStart(5)} gens    +${i.gain.toFixed(1)} pts`);
  }
  console.log(`\n  Total theoretical max gain: +${impacts.reduce((a, b) => a + b.gain, 0).toFixed(1)} pts`);

  // Save
  const report = {
    timestamp: new Date().toISOString(),
    noVerifiedCount: noVerified.length,
    brandTiers,
    emptiest: genScores.slice(0, 50).map(gs => gs.gen),
    impacts: impacts.map(i => ({ ...i })),
  };
  const reportPath = path.join(DATA_DIR, 'real-data-gaps-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report: ${reportPath}`);
}

main().catch(console.error);
