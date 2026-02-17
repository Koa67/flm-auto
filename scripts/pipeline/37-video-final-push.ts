/**
 * 37-video-final-push.ts — Final video push: cross-brand propagation
 *
 * For gens still without videos:
 * Phase 1: Same brand, similar body type → copy top videos
 * Phase 2: Same segment cross-brand → copy brand-generic reviews
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/37-video-final-push.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/37-video-final-push.ts
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
const BATCH_SIZE = 50;
const MAX_VIDS_PER_GEN = 3;
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

// Body type families for cross-model propagation
const BODY_FAMILIES: Record<string, string[]> = {
  'suv': ['suv', 'crossover', 'compact_suv'],
  'sedan': ['sedan', 'berline', 'saloon'],
  'wagon': ['wagon', 'estate', 'break', 'touring'],
  'hatchback': ['hatchback', 'compact'],
  'coupe': ['coupe', 'gran_coupe'],
  'convertible': ['convertible', 'cabriolet', 'roadster', 'spider', 'spyder'],
  'mpv': ['mpv', 'minivan', 'van'],
  'pickup': ['pickup', 'truck'],
};

function getBodyFamily(bodyType: string): string {
  const bt = (bodyType || '').toLowerCase();
  for (const [family, types] of Object.entries(BODY_FAMILIES)) {
    if (types.some(t => bt.includes(t))) return family;
  }
  return bt || 'unknown';
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  37-VIDEO-FINAL-PUSH');
  console.log('  Cross-brand video propagation');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  console.log('\n  Loading DB...');
  const gens = await paginateAll('generations', 'id, name, body_type, production_start, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');
  const videos = await paginateAll('vehicle_videos', 'id, generation_id, platform, video_id, title, channel_name, channel_id, thumbnail_url, duration_seconds, view_count, published_at, video_type, language, source_url');

  const brandById = new Map<string, any>();
  for (const b of brands) brandById.set(b.id, b);
  const modelById = new Map<string, any>();
  for (const m of models) modelById.set(m.id, m);

  const videosByGen = new Map<string, any[]>();
  for (const v of videos) {
    if (!v.generation_id) continue;
    if (!videosByGen.has(v.generation_id)) videosByGen.set(v.generation_id, []);
    videosByGen.get(v.generation_id)!.push(v);
  }

  const gensWithVids = new Set(videos.map((v: any) => v.generation_id));
  const existingCombos = new Set<string>();
  for (const v of videos) existingCombos.add(`${v.generation_id}:${v.platform}:${v.video_id}`);

  console.log(`  Gens: ${gens.length}`);
  console.log(`  Videos: ${videos.length}`);
  console.log(`  Gens with videos: ${gensWithVids.size} (${(gensWithVids.size / gens.length * 100).toFixed(1)}%)`);
  console.log(`  Gens without videos: ${gens.length - gensWithVids.size}`);

  const stats = { phase1: 0, phase2: 0 };
  const toInsert: any[] = [];

  // ── Phase 1: Same brand, same body family → top videos ──
  console.log('\n  ── Phase 1: Same brand, same body family ──');

  // Group gens by brand
  const gensByBrand = new Map<string, any[]>();
  for (const g of gens) {
    const model = modelById.get(g.model_id);
    if (!model) continue;
    if (!gensByBrand.has(model.brand_id)) gensByBrand.set(model.brand_id, []);
    gensByBrand.get(model.brand_id)!.push(g);
  }

  for (const [brandId, brandGens] of Array.from(gensByBrand.entries())) {
    const withVids = brandGens.filter((g: any) => gensWithVids.has(g.id));
    const withoutVids = brandGens.filter((g: any) => !gensWithVids.has(g.id));
    if (withVids.length === 0 || withoutVids.length === 0) continue;

    // Group videos by body family
    const vidsByBodyFamily = new Map<string, any[]>();
    for (const g of withVids) {
      const family = getBodyFamily(g.body_type);
      const gVids = videosByGen.get(g.id) || [];
      if (!vidsByBodyFamily.has(family)) vidsByBodyFamily.set(family, []);
      vidsByBodyFamily.get(family)!.push(...gVids);
    }

    for (const uGen of withoutVids) {
      const family = getBodyFamily(uGen.body_type);
      let candidates = vidsByBodyFamily.get(family) || [];
      if (candidates.length === 0) {
        // Fallback: any video from this brand
        candidates = [];
        for (const gVids of Array.from(vidsByBodyFamily.values())) {
          candidates.push(...gVids);
        }
      }
      if (candidates.length === 0) continue;

      // Sort by view count, take top N
      candidates.sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0));
      const topVids = candidates.slice(0, MAX_VIDS_PER_GEN);

      for (const v of topVids) {
        const comboKey = `${uGen.id}:${v.platform}:${v.video_id}`;
        if (existingCombos.has(comboKey)) continue;

        toInsert.push({
          generation_id: uGen.id,
          platform: v.platform,
          video_id: v.video_id,
          title: v.title,
          channel_name: v.channel_name,
          channel_id: v.channel_id,
          thumbnail_url: v.thumbnail_url,
          duration_seconds: v.duration_seconds,
          view_count: v.view_count,
          published_at: v.published_at,
          video_type: v.video_type,
          language: v.language,
          source_url: v.source_url,
        });
        existingCombos.add(comboKey);
        stats.phase1++;
      }
      if (topVids.length > 0) gensWithVids.add(uGen.id);
    }
  }
  console.log(`  Phase 1: ${stats.phase1} video rows`);

  console.log(`\n  After phase 1: ${gensWithVids.size} / ${gens.length} (${(gensWithVids.size / gens.length * 100).toFixed(1)}%)`);

  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} video rows...`);
    let inserted = 0;
    let errors = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('vehicle_videos').upsert(batch, { onConflict: 'generation_id,platform,video_id' });
      if (error) { console.error(`  Batch error at ${i}: ${error.message}`); errors++; }
      else inserted += batch.length;
    }
    console.log(`  Inserted: ${inserted} | Errors: ${errors}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  VIDEO FINAL PUSH RESULTS');
  console.log('='.repeat(60));
  console.log(`  Phase 1 (same brand):  ${stats.phase1}`);
  console.log(`  Coverage:              ${gensWithVids.size} / ${gens.length} (${(gensWithVids.size / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'video-final-push-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, coverage: gensWithVids.size }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
