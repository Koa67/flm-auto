/**
 * audit-coverage.ts — Audit data coverage and identify gaps
 *
 * Produces a gap report showing which generations are missing:
 * - Photos, Videos, Specs, Interior dimensions, Safety ratings
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/audit-coverage.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error(`  Paginate error ${table}: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

function fmt(n: number): string { return n.toLocaleString('fr-FR'); }

function pct(num: number, den: number): string {
  if (den === 0) return '0.0%';
  return `${((num / den) * 100).toFixed(1)}%`;
}

async function main() {
  console.log('');
  console.log('#'.repeat(60));
  console.log('#  AUDIT COVERAGE — Data Gap Report');
  console.log(`#  ${new Date().toISOString()}`);
  console.log('#'.repeat(60));

  // Load all generations with brand/model info
  console.log('\nLoading core data...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, model:models(id, name, brand:brands(id, name))'
  );
  const genIds = new Set(gens.map(g => g.id));
  console.log(`  Generations: ${fmt(gens.length)}`);

  // Load coverage data
  const [images, videos, specs, dims, safety, familyFit] = await Promise.all([
    paginateAll('vehicle_images', 'generation_id'),
    paginateAll('vehicle_videos', 'generation_id'),
    paginateAll('third_party_specs', 'generation_id'),
    paginateAll('interior_dimensions', 'generation_id'),
    paginateAll('safety_ratings', 'generation_id'),
    paginateAll('family_fit_compatibility', 'generation_id'),
  ]);

  const gensWithImages = new Set(images.map(i => i.generation_id));
  const gensWithVideos = new Set(videos.map(v => v.generation_id));
  const gensWithSpecs = new Set(specs.map(s => s.generation_id));
  const gensWithDims = new Set(dims.map(d => d.generation_id));
  const gensWithSafety = new Set(safety.map(s => s.generation_id));
  const gensWithFamily = new Set(familyFit.map(f => f.generation_id));

  // Coverage summary
  console.log('\n' + '='.repeat(60));
  console.log('  COVERAGE SUMMARY');
  console.log('='.repeat(60));
  console.log(`  ${'Data Type'.padEnd(30)} ${'Has'.padStart(8)} ${'Missing'.padStart(8)} ${'Coverage'.padStart(10)}`);
  console.log(`  ${'-'.repeat(30)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(10)}`);

  const categories = [
    { name: 'Photos', set: gensWithImages, total: images.length },
    { name: 'Videos', set: gensWithVideos, total: videos.length },
    { name: 'Third-party specs', set: gensWithSpecs, total: specs.length },
    { name: 'Interior dimensions', set: gensWithDims, total: dims.length },
    { name: 'Safety ratings', set: gensWithSafety, total: safety.length },
    { name: 'Family fit', set: gensWithFamily, total: familyFit.length },
  ];

  for (const cat of categories) {
    const has = cat.set.size;
    const missing = gens.length - has;
    console.log(
      `  ${cat.name.padEnd(30)} ${fmt(has).padStart(8)} ${fmt(missing).padStart(8)} ${pct(has, gens.length).padStart(10)}`
    );
  }
  console.log(`  ${'Total rows:'.padEnd(30)}`);
  for (const cat of categories) {
    console.log(`    ${cat.name.padEnd(28)} ${fmt(cat.total).padStart(10)} rows`);
  }

  // Brand-level gaps
  console.log('\n' + '='.repeat(60));
  console.log('  BRAND-LEVEL GAPS (generations without photos)');
  console.log('='.repeat(60));

  const brandGaps: Record<string, { total: number; noPhotos: number; noSpecs: number; noDims: number }> = {};
  for (const gen of gens) {
    const model = gen.model as any;
    const brand = model?.brand?.name || '(unknown)';
    if (!brandGaps[brand]) brandGaps[brand] = { total: 0, noPhotos: 0, noSpecs: 0, noDims: 0 };
    brandGaps[brand].total++;
    if (!gensWithImages.has(gen.id)) brandGaps[brand].noPhotos++;
    if (!gensWithSpecs.has(gen.id)) brandGaps[brand].noSpecs++;
    if (!gensWithDims.has(gen.id)) brandGaps[brand].noDims++;
  }

  const sorted = Object.entries(brandGaps).sort((a, b) => b[1].noPhotos - a[1].noPhotos);
  console.log(`  ${'Brand'.padEnd(20)} ${'Gens'.padStart(6)} ${'No Photos'.padStart(10)} ${'No Specs'.padStart(10)} ${'No Dims'.padStart(10)}`);
  console.log(`  ${'-'.repeat(20)} ${'-'.repeat(6)} ${'-'.repeat(10)} ${'-'.repeat(10)} ${'-'.repeat(10)}`);
  for (const [brand, data] of sorted) {
    console.log(
      `  ${brand.padEnd(20)} ${String(data.total).padStart(6)} ${String(data.noPhotos).padStart(10)} ${String(data.noSpecs).padStart(10)} ${String(data.noDims).padStart(10)}`
    );
  }

  // Completely empty generations (no data at all)
  const completelyEmpty = gens.filter(g =>
    !gensWithImages.has(g.id) &&
    !gensWithSpecs.has(g.id) &&
    !gensWithDims.has(g.id) &&
    !gensWithVideos.has(g.id)
  );

  console.log('\n' + '='.repeat(60));
  console.log(`  COMPLETELY EMPTY GENERATIONS: ${fmt(completelyEmpty.length)}`);
  console.log('='.repeat(60));
  if (completelyEmpty.length <= 50) {
    for (const gen of completelyEmpty) {
      const model = gen.model as any;
      const brand = model?.brand?.name || '?';
      const modelName = model?.name || '?';
      console.log(`  - ${brand} ${modelName} / ${gen.name}`);
    }
  } else {
    console.log(`  (too many to list — ${completelyEmpty.length} generations)`);
    // Show first 20
    for (const gen of completelyEmpty.slice(0, 20)) {
      const model = gen.model as any;
      console.log(`  - ${model?.brand?.name || '?'} ${model?.name || '?'} / ${gen.name}`);
    }
    console.log(`  ... and ${completelyEmpty.length - 20} more`);
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    total_generations: gens.length,
    coverage: {
      photos: { has: gensWithImages.size, missing: gens.length - gensWithImages.size, rows: images.length },
      videos: { has: gensWithVideos.size, missing: gens.length - gensWithVideos.size, rows: videos.length },
      specs: { has: gensWithSpecs.size, missing: gens.length - gensWithSpecs.size, rows: specs.length },
      dimensions: { has: gensWithDims.size, missing: gens.length - gensWithDims.size, rows: dims.length },
      safety: { has: gensWithSafety.size, missing: gens.length - gensWithSafety.size, rows: safety.length },
      family_fit: { has: gensWithFamily.size, missing: gens.length - gensWithFamily.size, rows: familyFit.length },
    },
    brand_gaps: Object.fromEntries(sorted),
    completely_empty_count: completelyEmpty.length,
  };

  const reportPath = path.resolve(__dirname, '../../data/gap-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  Report saved: data/gap-report.json`);
  console.log('');
}

main().catch(console.error);
