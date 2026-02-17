/**
 * 49-photos-videos-push.ts — Reclassify photos by URL + push videos for E-only gens
 *
 * Photos: Reclassify confidence by URL patterns when source/width are missing
 * Videos: For 1,245 gens with ONLY E videos, propagate A/B from same model
 *
 * NO DELETIONS. Only confidence retagging + video propagation.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/49-photos-videos-push.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/49-photos-videos-push.ts
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

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║  49-PHOTOS-VIDEOS-PUSH                                                       ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                                                    ║`);
  console.log('╚' + '═'.repeat(78) + '╝');

  const gens = await paginateAll('generations', 'id, name, model_id');
  const models = await paginateAll('models', 'id, name, brand_id');
  const brands = await paginateAll('brands', 'id, name');

  const modelById = new Map<string, any>();
  for (const m of models) modelById.set(m.id, m);
  const brandById = new Map<string, any>();
  for (const b of brands) brandById.set(b.id, b);

  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  console.log(`  Gens: ${gens.length}`);

  // ══════════════════════════════════════════════════════════
  // PART 1: PHOTO RECLASSIFICATION
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PART 1: PHOTO RECLASSIFICATION BY URL');
  console.log('═══════════════════════════════════════════════════════════════');

  const URL_PATTERNS: { pattern: string; confidence: string }[] = [
    { pattern: 'ultimatespecs', confidence: 'A' },
    { pattern: 'cdn.euroncap', confidence: 'A' },
    { pattern: 'upload.wikimedia', confidence: 'A' },
    { pattern: 'commons.wikimedia', confidence: 'A' },
    { pattern: 'pexels', confidence: 'B' },
  ];

  const photoBefore: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const photoAfter: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let photoUpdates = 0;
  let photoPage = 0;

  while (true) {
    const { data: rows, error } = await supabase.from('vehicle_images')
      .select('id, url, source, width, confidence')
      .range(photoPage * 1000, (photoPage + 1) * 1000 - 1);
    if (error || !rows || rows.length === 0) break;

    const pageUpdates: { id: string; confidence: string }[] = [];

    for (const row of rows) {
      const oldConf = row.confidence || 'C';
      photoBefore[oldConf] = (photoBefore[oldConf] || 0) + 1;

      // Only reclassify C and D (don't touch A, B, or E)
      if (oldConf !== 'C' && oldConf !== 'D') {
        photoAfter[oldConf]++;
        continue;
      }

      const url = (row.url || '').toLowerCase();
      const source = (row.source || '').toLowerCase();
      const width = row.width || 0;
      let newConf = oldConf;

      // Check URL patterns
      for (const { pattern, confidence } of URL_PATTERNS) {
        if (url.includes(pattern) || source.includes(pattern)) {
          if (confidence < newConf) newConf = confidence; // A < B < C alphabetically
          break;
        }
      }

      // Wikimedia with width info
      if (newConf === oldConf && (url.includes('wikimedia') || source.includes('wikimedia') || source.includes('wikipedia'))) {
        if (width >= 1280) newConf = 'A';
        else newConf = 'B';
      }

      // Any URL with good resolution
      if (newConf === oldConf && width >= 1920) newConf = 'B';
      if (newConf === oldConf && width >= 800) newConf = 'B';

      photoAfter[newConf]++;

      if (newConf !== oldConf) {
        pageUpdates.push({ id: row.id, confidence: newConf });
      }
    }

    if (!DRY_RUN && pageUpdates.length > 0) {
      const byConf: Record<string, string[]> = {};
      for (const u of pageUpdates) {
        if (!byConf[u.confidence]) byConf[u.confidence] = [];
        byConf[u.confidence].push(u.id);
      }
      for (const [conf, ids] of Object.entries(byConf)) {
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const batch = ids.slice(i, i + BATCH_SIZE);
          await supabase.from('vehicle_images').update({ confidence: conf }).in('id', batch);
        }
      }
      photoUpdates += pageUpdates.length;
    }

    if (photoPage % 50 === 0 && photoPage > 0) {
      process.stdout.write(`    ... page ${photoPage}\r`);
    }
    if (rows.length < 1000) break;
    photoPage++;
  }

  console.log('\n  PHOTOS — BEFORE vs AFTER');
  console.log('               BEFORE    AFTER');
  for (const c of ['A', 'B', 'C', 'D', 'E']) {
    console.log(`  ${c}        ${String(photoBefore[c] || 0).padStart(8)}  ${String(photoAfter[c] || 0).padStart(8)}`);
  }
  console.log(`  Updates: ${photoUpdates}`);

  // Count gen coverage before/after
  const photoGenBefore = new Set<string>();
  const photoGenAfter = new Set<string>();
  let pgp = 0;
  while (true) {
    const { data, error } = await supabase.from('vehicle_images')
      .select('generation_id, confidence')
      .range(pgp * 1000, (pgp + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data) {
      if (r.confidence === 'A' || r.confidence === 'B') {
        photoGenAfter.add(r.generation_id);
      }
    }
    if (data.length < 1000) break;
    pgp++;
  }

  console.log(`\n  Photo gen coverage (A+B): ${photoGenAfter.size} / ${gens.length} (${pct(photoGenAfter.size, gens.length)})`);

  // ══════════════════════════════════════════════════════════
  // PART 2: VIDEO PROPAGATION FOR E-ONLY GENS
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PART 2: VIDEO PROPAGATION FOR E-ONLY GENS');
  console.log('═══════════════════════════════════════════════════════════════');

  // Load video data
  const videos = await paginateAll('vehicle_videos', 'id, generation_id, platform, video_id, title, channel_name, thumbnail_url, duration_seconds, view_count, published_at, video_type, language, source_url, confidence');

  // Group by gen → find gens with ONLY E videos
  const videosByGen = new Map<string, any[]>();
  for (const v of videos) {
    if (!videosByGen.has(v.generation_id)) videosByGen.set(v.generation_id, []);
    videosByGen.get(v.generation_id)!.push(v);
  }

  const eOnlyGens: string[] = [];
  const hasGoodVideoGens = new Set<string>();

  for (const gen of gens) {
    const genVids = videosByGen.get(gen.id) || [];
    if (genVids.length === 0) continue;
    const hasNonE = genVids.some(v => v.confidence !== 'E');
    if (hasNonE) {
      hasGoodVideoGens.add(gen.id);
    } else {
      eOnlyGens.push(gen.id);
    }
  }

  console.log(`  Gens with good videos (A-D): ${hasGoodVideoGens.size}`);
  console.log(`  Gens with ONLY E videos: ${eOnlyGens.length}`);

  // For each E-only gen, find A/B videos from same model
  const existingCombos = new Set<string>();
  for (const v of videos) existingCombos.add(`${v.generation_id}:${v.platform}:${v.video_id}`);

  const videoInserts: any[] = [];
  let propagated = 0;

  for (const genId of eOnlyGens) {
    const gen = gens.find(g => g.id === genId);
    if (!gen) continue;

    const model = modelById.get(gen.model_id);
    const brand = model ? brandById.get(model.brand_id) : null;
    const brandName = brand?.name?.toLowerCase() || '';
    const modelName = model?.name?.toLowerCase() || '';

    // Find A/B videos from same model
    const modelGens = gensByModel.get(gen.model_id) || [];
    const candidateVideos: any[] = [];

    for (const mg of modelGens) {
      if (mg.id === genId) continue;
      const mgVids = videosByGen.get(mg.id) || [];
      for (const v of mgVids) {
        if (v.confidence === 'A' || v.confidence === 'B') {
          candidateVideos.push(v);
        }
      }
    }

    if (candidateVideos.length === 0) continue;

    // Sort by view count, take top 3
    candidateVideos.sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0));
    const top = candidateVideos.slice(0, 3);

    for (const v of top) {
      const combo = `${genId}:${v.platform}:${v.video_id}`;
      if (existingCombos.has(combo)) continue;

      // Check title relevance for confidence
      const title = (v.title || '').toLowerCase();
      const titleRelevant = (brandName && title.includes(brandName)) &&
                            (modelName && title.includes(modelName));

      videoInserts.push({
        generation_id: genId,
        platform: v.platform,
        video_id: v.video_id,
        title: v.title,
        channel_name: v.channel_name,
        thumbnail_url: v.thumbnail_url,
        duration_seconds: v.duration_seconds,
        view_count: v.view_count,
        published_at: v.published_at,
        video_type: v.video_type,
        language: v.language,
        source_url: v.source_url,
        confidence: titleRelevant ? 'B' : 'C',
      });
      existingCombos.add(combo);
      propagated++;
    }
  }

  console.log(`  Videos to propagate: ${videoInserts.length} for ${new Set(videoInserts.map(v => v.generation_id)).size} gens`);

  if (!DRY_RUN && videoInserts.length > 0) {
    let done = 0;
    for (let i = 0; i < videoInserts.length; i += BATCH_SIZE) {
      const batch = videoInserts.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('vehicle_videos').upsert(batch, { onConflict: 'generation_id,platform,video_id' });
      if (error) console.error(`  Video insert error: ${error.message}`);
      else done += batch.length;
    }
    console.log(`  Inserted: ${done}`);
  }

  // ── Final scores ──
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  FINAL COVERAGE');
  console.log('═══════════════════════════════════════════════════════════════');

  if (!DRY_RUN) {
    // Reload video coverage
    const freshVideoGenAB = new Set<string>();
    let fvp = 0;
    while (true) {
      const { data, error } = await supabase.from('vehicle_videos')
        .select('generation_id, confidence')
        .range(fvp * 1000, (fvp + 1) * 1000 - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data) { if (r.confidence === 'A' || r.confidence === 'B') freshVideoGenAB.add(r.generation_id); }
      if (data.length < 1000) break;
      fvp++;
    }

    console.log(`  Photos Verified (A+B): ${photoGenAfter.size} / ${gens.length} (${pct(photoGenAfter.size, gens.length)})`);
    console.log(`  Videos Verified (A+B): ${freshVideoGenAB.size} / ${gens.length} (${pct(freshVideoGenAB.size, gens.length)})`);
  }

  const report = {
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    photos: { before: photoBefore, after: photoAfter, updates: photoUpdates, genCoverage: photoGenAfter.size },
    videos: { eOnlyGens: eOnlyGens.length, propagated, inserts: videoInserts.length },
  };
  fs.writeFileSync(path.join(DATA_DIR, 'photos-videos-push-report.json'), JSON.stringify(report, null, 2));
  console.log(`\n  Report: ${path.join(DATA_DIR, 'photos-videos-push-report.json')}`);
}

main().catch(console.error);
