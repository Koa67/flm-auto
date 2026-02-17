/**
 * 47-video-dedup-audit.ts — Video duplication audit + retag absurd
 *
 * 1. Count unique video_ids vs total rows
 * 2. For each video_id duplicated >10 times: check year relevance
 * 3. Extract years from titles with regex, compare to gen production_start
 * 4. Retag E for videos where title mentions a year >10yr from gen
 *
 * NO DELETIONS. Only confidence retagging.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/47-video-dedup-audit.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/47-video-dedup-audit.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 200;
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

function extractYearsFromTitle(title: string): number[] {
  const matches = title.match(/(19|20)\d{2}/g);
  if (!matches) return [];
  return [...new Set(matches.map(Number))].filter(y => y >= 1950 && y <= 2030);
}

function getProdYear(gen: any): number | null {
  if (!gen?.production_start) return null;
  const s = String(gen.production_start);
  if (/^\d{4}$/.test(s)) return parseInt(s);
  if (/^\d{4}-/.test(s)) return parseInt(s.substring(0, 4));
  return null;
}

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║  47-VIDEO-DEDUP-AUDIT — Honest video assessment                               ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                                                    ║`);
  console.log('╚' + '═'.repeat(78) + '╝');

  console.log('\n  Loading data...');
  const gens = await paginateAll('generations', 'id, name, production_start, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');
  const videos = await paginateAll('vehicle_videos', 'id, generation_id, platform, video_id, title, published_at, confidence');

  const genById = new Map<string, any>();
  for (const g of gens) genById.set(g.id, g);
  const modelById = new Map<string, any>();
  for (const m of models) modelById.set(m.id, m);
  const brandById = new Map<string, any>();
  for (const b of brands) brandById.set(b.id, b);

  console.log(`  Videos: ${videos.length}`);
  console.log(`  Gens: ${gens.length}`);

  // ── 1. Duplication stats ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  1. DUPLICATION STATS');
  console.log('═══════════════════════════════════════════════════════════════');

  const videoIdCounts = new Map<string, number>();
  const uniqueVideoIds = new Set<string>();
  for (const v of videos) {
    const key = `${v.platform}:${v.video_id}`;
    uniqueVideoIds.add(key);
    videoIdCounts.set(key, (videoIdCounts.get(key) || 0) + 1);
  }

  console.log(`  Total video rows:     ${videos.length.toLocaleString()}`);
  console.log(`  Unique video_ids:     ${uniqueVideoIds.size.toLocaleString()}`);
  console.log(`  Duplication ratio:    ${(videos.length / uniqueVideoIds.size).toFixed(1)}:1`);

  // Distribution of duplication
  const dupDist: Record<string, number> = { '1 (unique)': 0, '2-5': 0, '6-10': 0, '11-20': 0, '21-50': 0, '50+': 0 };
  for (const [, count] of Array.from(videoIdCounts.entries())) {
    if (count === 1) dupDist['1 (unique)']++;
    else if (count <= 5) dupDist['2-5']++;
    else if (count <= 10) dupDist['6-10']++;
    else if (count <= 20) dupDist['11-20']++;
    else if (count <= 50) dupDist['21-50']++;
    else dupDist['50+']++;
  }

  console.log('\n  Duplication distribution (unique video_ids):');
  for (const [label, count] of Object.entries(dupDist)) {
    console.log(`    ${label.padEnd(15)} ${String(count).padStart(6)} videos`);
  }

  // Top 10 most duplicated
  const topDup = Array.from(videoIdCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log('\n  Top 10 most duplicated video_ids:');
  for (const [key, count] of topDup) {
    const sample = videos.find(v => `${v.platform}:${v.video_id}` === key);
    const title = (sample?.title || '').substring(0, 50);
    console.log(`    ${String(count).padStart(4)}× ${title}`);
  }

  // ── 2. Title-year vs gen-year analysis ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  2. TITLE-YEAR vs GEN-YEAR MISMATCH');
  console.log('═══════════════════════════════════════════════════════════════');

  let titleYearMatch = 0;
  let titleYearClose = 0;  // ≤3yr
  let titleYearFar = 0;    // 4-10yr
  let titleYearAbsurd = 0; // >10yr
  let noTitleYear = 0;
  let noGenYear = 0;
  const absurdIds: string[] = [];

  for (const v of videos) {
    if (v.confidence === 'E') continue; // Already tagged

    const gen = genById.get(v.generation_id);
    const prodYear = getProdYear(gen);
    if (!prodYear) { noGenYear++; continue; }

    const titleYears = extractYearsFromTitle(v.title || '');
    if (titleYears.length === 0) { noTitleYear++; continue; }

    // Find closest year match
    const minGap = Math.min(...titleYears.map(y => Math.abs(y - prodYear)));

    if (minGap <= 1) titleYearMatch++;
    else if (minGap <= 3) titleYearClose++;
    else if (minGap <= 10) titleYearFar++;
    else {
      titleYearAbsurd++;
      absurdIds.push(v.id);
    }
  }

  console.log(`  Title mentions year:     ${titleYearMatch + titleYearClose + titleYearFar + titleYearAbsurd}`);
  console.log(`    ≤1yr from gen:         ${titleYearMatch} (match)`);
  console.log(`    2-3yr from gen:        ${titleYearClose} (close)`);
  console.log(`    4-10yr from gen:       ${titleYearFar} (far)`);
  console.log(`    >10yr from gen:        ${titleYearAbsurd} (ABSURD → E)`);
  console.log(`  No year in title:        ${noTitleYear}`);
  console.log(`  No gen production year:  ${noGenYear}`);

  // Tag absurd ones as E
  if (!DRY_RUN && absurdIds.length > 0) {
    console.log(`\n  Tagging ${absurdIds.length} title-year-absurd videos as E...`);
    let done = 0;
    for (let i = 0; i < absurdIds.length; i += BATCH_SIZE) {
      const batch = absurdIds.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('vehicle_videos').update({ confidence: 'E' }).in('id', batch);
      if (error) console.error(`  Batch error: ${error.message}`);
      else done += batch.length;
    }
    console.log(`  Tagged: ${done}`);
  } else if (DRY_RUN) {
    console.log(`\n  [DRY] Would tag ${absurdIds.length} videos as E`);
  }

  // ── 3. Final video reality check ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  3. VIDEO REALITY CHECK');
  console.log('═══════════════════════════════════════════════════════════════');

  // Reload confidence after updates
  const videosFresh = DRY_RUN ? videos : await paginateAll('vehicle_videos', 'generation_id, confidence');

  const genVideoConf = new Map<string, string>();
  for (const v of videosFresh) {
    const existing = genVideoConf.get(v.generation_id);
    // Best confidence for this gen (A < B < C < D < E alphabetically)
    if (!existing || v.confidence < existing) {
      genVideoConf.set(v.generation_id, v.confidence || 'D');
    }
  }

  const videoTierCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, none: 0 };
  for (const gen of gens) {
    const conf = genVideoConf.get(gen.id);
    if (!conf) videoTierCounts.none++;
    else (videoTierCounts as any)[conf]++;
  }

  console.log(`\n  Total video rows:           ${videosFresh.length.toLocaleString()}`);
  console.log(`  Unique video_ids:           ${uniqueVideoIds.size.toLocaleString()}`);
  console.log(`  Duplication ratio:          ${(videosFresh.length / uniqueVideoIds.size).toFixed(1)}:1`);
  console.log('');
  console.log(`  Gens with native video (A):        ${String(videoTierCounts.A).padStart(5)} (${pct(videoTierCounts.A, gens.length)})`);
  console.log(`  Gens with relevant video (A+B):    ${String(videoTierCounts.A + videoTierCounts.B).padStart(5)} (${pct(videoTierCounts.A + videoTierCounts.B, gens.length)})`);
  console.log(`  Gens with any usable video (A-C):  ${String(videoTierCounts.A + videoTierCounts.B + videoTierCounts.C).padStart(5)} (${pct(videoTierCounts.A + videoTierCounts.B + videoTierCounts.C, gens.length)})`);
  console.log(`  Gens with any video (A-D):         ${String(videoTierCounts.A + videoTierCounts.B + videoTierCounts.C + videoTierCounts.D).padStart(5)} (${pct(videoTierCounts.A + videoTierCounts.B + videoTierCounts.C + videoTierCounts.D, gens.length)})`);
  console.log(`  Gens with absurd video only (E):   ${String(videoTierCounts.E).padStart(5)} (${pct(videoTierCounts.E, gens.length)})`);
  console.log(`  Gens with NO video at all:         ${String(videoTierCounts.none).padStart(5)} (${pct(videoTierCounts.none, gens.length)})`);

  // ── 4. Absurd video examples ──
  if (absurdIds.length > 0) {
    console.log('\n  ── Sample absurd videos (title year >10yr from gen) ──');
    const absurdSamples = videos
      .filter(v => absurdIds.includes(v.id))
      .slice(0, 10);

    for (const v of absurdSamples) {
      const gen = genById.get(v.generation_id);
      const prodYear = getProdYear(gen);
      const model = modelById.get(gen?.model_id);
      const brand = brandById.get(model?.brand_id);
      const titleYears = extractYearsFromTitle(v.title || '');
      console.log(`    ${(brand?.name || '?').padEnd(14)} ${(model?.name || '?').padEnd(16)} gen=${prodYear || '?'} title="${(v.title || '').substring(0, 40)}" years=[${titleYears}]`);
    }
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    totalRows: videos.length,
    uniqueVideoIds: uniqueVideoIds.size,
    dupRatio: (videos.length / uniqueVideoIds.size).toFixed(1),
    dupDistribution: dupDist,
    titleYearStats: { match: titleYearMatch, close: titleYearClose, far: titleYearFar, absurd: titleYearAbsurd, noTitle: noTitleYear, noGen: noGenYear },
    absurdTagged: absurdIds.length,
    genCoverage: videoTierCounts,
  };
  const reportPath = path.join(DATA_DIR, 'video-dedup-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report: ${reportPath}`);
}

main().catch(console.error);
