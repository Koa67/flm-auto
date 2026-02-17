/**
 * 30-propagate-videos.ts — Propagate videos intra-model
 *
 * For each model with some gens that have videos and some without:
 * Copy the top N videos (by view_count) to gens without videos.
 *
 * Prerequisite: UNIQUE constraint changed to (generation_id, platform, video_id)
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/30-propagate-videos.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonSQL"}' scripts/pipeline/30-propagate-videos.ts
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
const MAX_VIDEOS_PER_GEN = 5; // Copy top 5 videos to each uncovered gen
const YEAR_TOLERANCE = 12; // Wider tolerance for video relevance
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

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  30-PROPAGATE-VIDEOS');
  console.log('  Propagate videos intra-model');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load DB
  console.log('\n  Loading DB...');
  const gens = await paginateAll('generations', 'id, name, production_start, production_end, model_id');
  const videos = await paginateAll('vehicle_videos', 'id, generation_id, platform, video_id, title, channel_name, channel_id, thumbnail_url, duration_seconds, view_count, published_at, video_type, language, source_url');

  console.log(`  Generations: ${gens.length}`);
  console.log(`  Videos: ${videos.length}`);

  // Group gens by model
  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!g.model_id) continue;
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  // Group videos by generation
  const videosByGen = new Map<string, any[]>();
  for (const v of videos) {
    if (!v.generation_id) continue;
    if (!videosByGen.has(v.generation_id)) videosByGen.set(v.generation_id, []);
    videosByGen.get(v.generation_id)!.push(v);
  }

  // Track existing (generation_id, platform, video_id) combos
  const existingCombos = new Set<string>();
  for (const v of videos) {
    existingCombos.add(`${v.generation_id}:${v.platform}:${v.video_id}`);
  }

  const gensWithVideos = new Set(videos.map((v: any) => v.generation_id));
  console.log(`  Gens with videos: ${gensWithVideos.size} / ${gens.length}`);

  const stats = {
    modelsProcessed: 0,
    gensTargeted: 0,
    videosCreated: 0,
    skippedExisting: 0,
  };

  const toInsert: any[] = [];

  for (const [modelId, modelGens] of Array.from(gensByModel.entries())) {
    const withVids = modelGens.filter((g: any) => gensWithVideos.has(g.id));
    const withoutVids = modelGens.filter((g: any) => !gensWithVideos.has(g.id));
    if (withVids.length === 0 || withoutVids.length === 0) continue;

    stats.modelsProcessed++;

    // Collect all videos for this model, sorted by view_count desc
    const modelVideos: any[] = [];
    for (const g of withVids) {
      const gvids = videosByGen.get(g.id) || [];
      for (const v of gvids) {
        modelVideos.push({ ...v, sourceGenId: g.id, sourceGenStart: g.production_start });
      }
    }
    modelVideos.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));

    for (const uGen of withoutVids) {
      const uStart = uGen.production_start ? new Date(uGen.production_start).getFullYear() : null;

      // Find best videos for this gen (prefer temporal proximity)
      const candidateVideos = modelVideos.filter(v => {
        if (!uStart) return true;
        const vStart = v.sourceGenStart ? new Date(v.sourceGenStart).getFullYear() : null;
        if (!vStart) return true;
        return Math.abs(uStart - vStart) <= YEAR_TOLERANCE;
      });

      // Take top N by view count
      const topVideos = candidateVideos.slice(0, MAX_VIDEOS_PER_GEN);
      if (topVideos.length === 0) continue;

      stats.gensTargeted++;

      for (const v of topVideos) {
        const comboKey = `${uGen.id}:${v.platform}:${v.video_id}`;
        if (existingCombos.has(comboKey)) {
          stats.skippedExisting++;
          continue;
        }

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
        stats.videosCreated++;
      }
    }
  }

  console.log(`\n  Models processed: ${stats.modelsProcessed}`);
  console.log(`  Gens targeted: ${stats.gensTargeted}`);
  console.log(`  Videos to create: ${stats.videosCreated}`);
  console.log(`  Skipped existing: ${stats.skippedExisting}`);

  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Inserting ${toInsert.length} video rows...`);
    let inserted = 0;
    let errors = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('vehicle_videos').upsert(batch, { onConflict: 'generation_id,platform,video_id' });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
        errors++;
      } else {
        inserted += batch.length;
      }
    }
    console.log(`  Inserted: ${inserted} | Errors: ${errors}`);
  }

  // Calculate new coverage
  const newGensWithVids = new Set([...gensWithVideos]);
  for (const r of toInsert) newGensWithVids.add(r.generation_id);

  console.log('\n' + '='.repeat(60));
  console.log('  VIDEO PROPAGATION RESULTS');
  console.log('='.repeat(60));
  console.log(`  Models with mixed coverage: ${stats.modelsProcessed}`);
  console.log(`  Gens targeted: ${stats.gensTargeted}`);
  console.log(`  Video rows created: ${stats.videosCreated}`);
  console.log(`  Coverage: ${gensWithVideos.size} → ${newGensWithVids.size} / ${gens.length} (${(newGensWithVids.size / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'propagate-videos-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    stats,
    before: gensWithVideos.size,
    after: newGensWithVids.size,
    total: gens.length,
  }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
