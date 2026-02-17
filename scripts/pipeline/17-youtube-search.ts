/**
 * 17-youtube-search.ts — Fill video gaps via YouTube Data API v3
 *
 * For generations with 0 videos, searches YouTube for review content.
 * YouTube API quota: 10,000 units/day, 1 search = 100 units → max 95 searches/day.
 *
 * Requires YOUTUBE_API_KEY in .env.local
 * If no API key, script exits gracefully.
 *
 * Checkpoint-based: can be stopped and resumed.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/17-youtube-search.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/17-youtube-search.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/17-youtube-search.ts --limit=50
 */

import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) { console.error('Missing env vars'); process.exit(1); }
const supabase = createClient(supabaseUrl, serviceRoleKey);

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 95; // default 95 = daily limit
const BATCH_SIZE = 50;
const DELAY_MS = 500;
const DATA_DIR = path.resolve(__dirname, '../../data');
const CHECKPOINT_PATH = path.join(DATA_DIR, 'youtube-search-checkpoint.json');

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode !== 200) {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`)));
        return;
      }
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse: ${e}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

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

async function searchYouTube(query: string, maxResults: number = 5): Promise<any[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encoded}&key=${YOUTUBE_API_KEY}`;
  const data = await fetchJSON(url);
  return data.items || [];
}

function classifyVideoType(title: string): string {
  const t = title.toLowerCase();
  if (/crash|ncap|safety|impact/i.test(t)) return 'crash_test';
  if (/\bvs\b|comparati|comparison|match/i.test(t)) return 'comparison';
  if (/walkaround|walk.?around|tour|visite|exterior|interior/i.test(t)) return 'walkaround';
  if (/review|test|essai|avis|drive|driven|pov/i.test(t)) return 'review';
  return 'other';
}

function detectLanguage(title: string): string {
  if (/essai|avis|voiture|conduite|intérieur/i.test(title)) return 'fr';
  if (/prueba|revisión|conducción/i.test(title)) return 'es';
  if (/test|fahrbericht|bewertung/i.test(title)) return 'de';
  return 'en';
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  17-YOUTUBE-SEARCH — Fill video gaps');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Limit: ${LIMIT} searches`);
  console.log('='.repeat(60));

  // Check API key
  if (!YOUTUBE_API_KEY) {
    console.log('\n  ⚠ No YOUTUBE_API_KEY found in .env.local — skipping.');
    console.log('  Set YOUTUBE_API_KEY to enable YouTube video search.');
    return;
  }

  // Load data
  console.log('\n  Loading DB...');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, model:models(id, name, slug, brand:brands(id, name, slug))'
  );
  console.log(`  Generations: ${gens.length}`);

  const videos = await paginateAll('vehicle_videos', 'generation_id');
  const gensWithVideos = new Set(videos.map((v: any) => v.generation_id));
  console.log(`  Gens with videos: ${gensWithVideos.size}`);

  // Gens needing videos
  const missing = gens.filter((g: any) => !gensWithVideos.has(g.id));
  console.log(`  Gens WITHOUT videos: ${missing.length}`);

  // Load checkpoint
  let processedSet = new Set<string>();
  if (fs.existsSync(CHECKPOINT_PATH)) {
    const cp = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'));
    processedSet = new Set(cp.processed || []);
    console.log(`  Checkpoint: ${processedSet.size} already processed`);
  }

  const toProcess = missing.filter((g: any) => !processedSet.has(g.id));
  const limited = toProcess.slice(0, LIMIT);
  console.log(`  To process: ${limited.length}`);

  const stats = {
    searches: 0,
    gensWithResults: 0,
    gensNoResults: 0,
    videosFound: 0,
    videosInserted: 0,
    quotaErrors: 0,
    errors: 0,
  };

  const toInsert: any[] = [];

  for (let i = 0; i < limited.length; i++) {
    const gen = limited[i];
    const model = gen.model as any;
    if (!model?.brand) continue;

    const brand = model.brand.name;
    const modelName = model.name;
    const query = `${brand} ${modelName} review test`;

    try {
      const results = await searchYouTube(query, 3);
      stats.searches++;
      await sleep(DELAY_MS);

      if (results.length > 0) {
        stats.gensWithResults++;
        stats.videosFound += results.length;

        for (const item of results) {
          const videoId = item.id?.videoId;
          if (!videoId) continue;

          toInsert.push({
            generation_id: gen.id,
            platform: 'youtube',
            video_id: videoId,
            title: (item.snippet?.title || '').substring(0, 500),
            channel_name: item.snippet?.channelTitle || '',
            thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
            published_at: item.snippet?.publishedAt || null,
            video_type: classifyVideoType(item.snippet?.title || ''),
            language: detectLanguage(item.snippet?.title || ''),
            source_url: `https://www.youtube.com/watch?v=${videoId}`,
          });
        }
      } else {
        stats.gensNoResults++;
      }

      processedSet.add(gen.id);

      if ((i + 1) % 10 === 0) {
        process.stdout.write(`  [${i + 1}/${limited.length}] ${stats.videosFound} videos\n`);
        // Save checkpoint
        fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify({
          processed: Array.from(processedSet),
          timestamp: new Date().toISOString(),
        }));
      }
    } catch (e: any) {
      if (e.message?.includes('403') || e.message?.includes('quota')) {
        stats.quotaErrors++;
        console.log(`\n  ⚠ Quota exceeded at search #${stats.searches}. Stopping.`);
        break;
      }
      stats.errors++;
      await sleep(DELAY_MS * 2);
    }
  }

  // Save final checkpoint
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify({
    processed: Array.from(processedSet),
    timestamp: new Date().toISOString(),
  }));

  // Deduplicate by video_id (same video may appear for multiple gens)
  const seenVideoIds = new Set<string>();
  const dedupedInsert = toInsert.filter((r: any) => {
    const key = `${r.platform || 'youtube'}:${r.video_id}`;
    if (seenVideoIds.has(key)) return false;
    seenVideoIds.add(key);
    return true;
  });
  console.log(`  Deduplicated: ${toInsert.length} → ${dedupedInsert.length}`);

  // Insert
  if (!DRY_RUN && dedupedInsert.length > 0) {
    console.log(`\n  Inserting ${dedupedInsert.length} videos...`);
    let inserted = 0;
    for (let i = 0; i < dedupedInsert.length; i += BATCH_SIZE) {
      const batch = dedupedInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('vehicle_videos').upsert(batch, {
        onConflict: 'platform,video_id'
      });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }
    stats.videosInserted = inserted;
    console.log(`  Inserted: ${inserted}`);
  }

  // Results
  const newGensWithVideos = gensWithVideos.size + stats.gensWithResults;
  console.log('\n' + '='.repeat(60));
  console.log('  YOUTUBE SEARCH RESULTS');
  console.log('='.repeat(60));
  console.log(`  Searches:        ${stats.searches} (of ${LIMIT} max)`);
  console.log(`  Gens with vids:  ${stats.gensWithResults}`);
  console.log(`  Gens no results: ${stats.gensNoResults}`);
  console.log(`  Videos found:    ${stats.videosFound}`);
  console.log(`  Inserted:        ${DRY_RUN ? '(dry run)' : stats.videosInserted}`);
  console.log(`  Quota errors:    ${stats.quotaErrors}`);
  console.log(`  Other errors:    ${stats.errors}`);
  console.log(`  Video coverage:  ${gensWithVideos.size} → ${newGensWithVideos} / ${gens.length} (${(newGensWithVideos / gens.length * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'youtube-search-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), stats, before: gensWithVideos.size, after: newGensWithVideos }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
