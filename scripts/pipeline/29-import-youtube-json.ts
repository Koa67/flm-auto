/**
 * 29-import-youtube-json.ts — Import pre-scraped YouTube videos from JSON
 *
 * Reads data/youtube_videos.json (633 videos, 0 HTTP requests).
 * Matches brand+model to DB generations, assigns each video to best gen.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/29-import-youtube-json.ts --dry-run
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/pipeline/29-import-youtube-json.ts
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

/** Parse ISO 8601 duration (PT21M15S) to seconds */
function parseDuration(iso: string): number | null {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
}

/** Classify video type from title */
function classifyVideoType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('review') || t.includes('essai') || t.includes('test drive')) return 'review';
  if (t.includes('interior') || t.includes('intérieur')) return 'interior';
  if (t.includes('exterior') || t.includes('extérieur') || t.includes('walkaround') || t.includes('walk around')) return 'walkaround';
  if (t.includes('crash') || t.includes('ncap') || t.includes('safety')) return 'crash_test';
  if (t.includes('drag race') || t.includes('0-100') || t.includes('0-60') || t.includes('acceleration')) return 'performance';
  if (t.includes('pov') || t.includes('driving')) return 'driving';
  if (t.includes('comparison') || t.includes('vs') || t.includes('comparatif')) return 'comparison';
  if (t.includes('sound') || t.includes('exhaust')) return 'sound';
  return 'review';
}

/** Detect language from title */
function detectLanguage(title: string): string {
  const t = title.toLowerCase();
  if (/\b(essai|intérieur|extérieur|comparatif|voiture|moteur|puissance)\b/.test(t)) return 'fr';
  if (/\b(prueba|coches|motor|velocidad)\b/.test(t)) return 'es';
  if (/\b(test|fahrbericht|antrieb|innen)\b/.test(t)) return 'de';
  return 'en';
}

/** Extract year hints from video title */
function extractYearFromTitle(title: string): number | null {
  // Look for 4-digit years 1990-2027
  const years = title.match(/\b(19[9]\d|20[0-2]\d)\b/g);
  if (!years) return null;
  // Prefer the largest year (usually the model year)
  return Math.max(...years.map(Number));
}

/** Known chassis codes that help identify generation */
const CHASSIS_PATTERNS: Record<string, RegExp> = {
  // BMW
  'E36': /\bE36\b/i, 'E46': /\bE46\b/i, 'E90': /\bE90\b/i, 'F30': /\bF30\b/i, 'G20': /\bG20\b/i, 'G21': /\bG21\b/i,
  'E39': /\bE39\b/i, 'E60': /\bE60\b/i, 'F10': /\bF10\b/i, 'G30': /\bG30\b/i, 'G31': /\bG31\b/i,
  'E53': /\bE53\b/i, 'E70': /\bE70\b/i, 'F15': /\bF15\b/i, 'G05': /\bG05\b/i,
  'F25': /\bF25\b/i, 'G01': /\bG01\b/i,
  // Mercedes
  'W203': /\bW203\b/i, 'W204': /\bW204\b/i, 'W205': /\bW205\b/i, 'W206': /\bW206\b/i,
  'W210': /\bW210\b/i, 'W211': /\bW211\b/i, 'W212': /\bW212\b/i, 'W213': /\bW213\b/i,
  'W220': /\bW220\b/i, 'W221': /\bW221\b/i, 'W222': /\bW222\b/i, 'W223': /\bW223\b/i,
  // Porsche
  '991': /\b991\b/i, '992': /\b992\b/i, '997': /\b997\b/i, '996': /\b996\b/i,
  // VW
  'MK7': /\b(?:Mk\s*7|MK7|VII)\b/i, 'MK8': /\b(?:Mk\s*8|MK8|VIII)\b/i,
  'MK6': /\b(?:Mk\s*6|MK6|VI)\b/i, 'MK5': /\b(?:Mk\s*5|MK5)\b/i,
};

interface VideoJSON {
  videoId: string;
  title: string;
  channelId?: string;
  channelTitle: string;
  publishedAt: string;
  description?: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount?: number;
  duration: string;
}

interface VehicleJSON {
  brand: string;
  model: string;
  videos: VideoJSON[];
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  29-IMPORT-YOUTUBE-JSON');
  console.log('  Import pre-scraped YouTube videos from JSON');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load JSON
  const jsonPath = path.join(DATA_DIR, 'youtube_videos.json');
  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const vehicles: VehicleJSON[] = json.vehicles;
  const totalVideos = vehicles.reduce((s: number, v: VehicleJSON) => s + v.videos.length, 0);
  console.log(`\n  JSON: ${vehicles.length} vehicles, ${totalVideos} videos`);

  // Load DB
  console.log('  Loading DB...');
  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name, brand_id');
  const gens = await paginateAll('generations', 'id, name, production_start, production_end, model_id');

  const brandByName = new Map<string, any>();
  for (const b of brands) brandByName.set(b.name.toLowerCase(), b);

  const modelsByBrandId = new Map<string, any[]>();
  for (const m of models) {
    if (!modelsByBrandId.has(m.brand_id)) modelsByBrandId.set(m.brand_id, []);
    modelsByBrandId.get(m.brand_id)!.push(m);
  }

  const gensByModelId = new Map<string, any[]>();
  for (const g of gens) {
    if (!g.model_id) continue;
    if (!gensByModelId.has(g.model_id)) gensByModelId.set(g.model_id, []);
    gensByModelId.get(g.model_id)!.push(g);
  }

  // Check existing videos to skip duplicates
  const existingVids = await paginateAll('vehicle_videos', 'video_id');
  const existingVideoIds = new Set(existingVids.map((v: any) => v.video_id));
  console.log(`  Existing videos in DB: ${existingVids.length}`);
  console.log(`  Brands: ${brands.length} | Models: ${models.length} | Gens: ${gens.length}`);

  const stats = {
    matched: 0,
    unmatched: 0,
    skippedExisting: 0,
    inserted: 0,
    brandMissed: [] as string[],
    modelMissed: [] as string[],
  };

  const toInsert: any[] = [];

  for (const vehicle of vehicles) {
    if (vehicle.videos.length === 0) continue;

    // Find brand
    const brand = brandByName.get(vehicle.brand.toLowerCase());
    if (!brand) {
      stats.brandMissed.push(vehicle.brand);
      stats.unmatched += vehicle.videos.length;
      continue;
    }

    // Find model
    const brandModels = modelsByBrandId.get(brand.id) || [];
    let model = brandModels.find((m: any) => m.name.toLowerCase() === vehicle.model.toLowerCase());
    if (!model) {
      // Try partial match
      model = brandModels.find((m: any) =>
        m.name.toLowerCase().includes(vehicle.model.toLowerCase()) ||
        vehicle.model.toLowerCase().includes(m.name.toLowerCase())
      );
    }
    if (!model) {
      stats.modelMissed.push(`${vehicle.brand} ${vehicle.model}`);
      stats.unmatched += vehicle.videos.length;
      continue;
    }

    // Get model generations sorted by production_start desc
    const modelGens = (gensByModelId.get(model.id) || []).sort((a: any, b: any) => {
      const aStart = a.production_start ? new Date(a.production_start).getTime() : 0;
      const bStart = b.production_start ? new Date(b.production_start).getTime() : 0;
      return bStart - aStart;
    });

    if (modelGens.length === 0) {
      stats.unmatched += vehicle.videos.length;
      continue;
    }

    for (const video of vehicle.videos) {
      // Skip if already in DB
      if (existingVideoIds.has(video.videoId)) {
        stats.skippedExisting++;
        continue;
      }

      // Find best generation for this video
      let bestGen = modelGens[0]; // Default to most recent

      // Try year from title
      const titleYear = extractYearFromTitle(video.title);

      // Try chassis code from title
      let chassisMatch: string | null = null;
      for (const [code, pattern] of Object.entries(CHASSIS_PATTERNS)) {
        if (pattern.test(video.title)) {
          chassisMatch = code;
          break;
        }
      }

      if (chassisMatch) {
        // Match chassis code to generation name
        const genMatch = modelGens.find((g: any) =>
          g.name && g.name.toUpperCase().includes(chassisMatch!.toUpperCase())
        );
        if (genMatch) bestGen = genMatch;
      } else if (titleYear) {
        // Match by year: find gen where titleYear falls within production range
        for (const g of modelGens) {
          const gStart = g.production_start ? new Date(g.production_start).getFullYear() : null;
          const gEnd = g.production_end ? new Date(g.production_end).getFullYear() : null;
          if (gStart && titleYear >= gStart - 1 && titleYear <= (gEnd || gStart + 10)) {
            bestGen = g;
            break;
          }
        }
      } else {
        // Use publish date to guess
        const pubYear = video.publishedAt ? new Date(video.publishedAt).getFullYear() : null;
        if (pubYear) {
          for (const g of modelGens) {
            const gStart = g.production_start ? new Date(g.production_start).getFullYear() : null;
            const gEnd = g.production_end ? new Date(g.production_end).getFullYear() : null;
            if (gStart && pubYear >= gStart - 1 && pubYear <= (gEnd || gStart + 8)) {
              bestGen = g;
              break;
            }
          }
        }
      }

      const durationSec = parseDuration(video.duration);

      toInsert.push({
        generation_id: bestGen.id,
        platform: 'youtube',
        video_id: video.videoId,
        title: video.title,
        channel_name: video.channelTitle,
        channel_id: video.channelId || null,
        thumbnail_url: video.thumbnailUrl,
        duration_seconds: durationSec,
        view_count: video.viewCount || null,
        published_at: video.publishedAt || null,
        video_type: classifyVideoType(video.title),
        language: detectLanguage(video.title),
        source_url: `https://www.youtube.com/watch?v=${video.videoId}`,
      });
      existingVideoIds.add(video.videoId); // Prevent dupes within batch
      stats.matched++;
    }
  }

  console.log(`\n  Matched: ${stats.matched} | Skipped existing: ${stats.skippedExisting} | Unmatched: ${stats.unmatched}`);
  if (stats.brandMissed.length > 0) console.log(`  Brands not found: ${[...new Set(stats.brandMissed)].join(', ')}`);
  if (stats.modelMissed.length > 0) console.log(`  Models not found: ${[...new Set(stats.modelMissed)].join(', ')}`);

  // Show gen distribution
  const genCounts = new Map<string, number>();
  for (const r of toInsert) {
    genCounts.set(r.generation_id, (genCounts.get(r.generation_id) || 0) + 1);
  }
  console.log(`  Unique generations targeted: ${genCounts.size}`);

  if (!DRY_RUN && toInsert.length > 0) {
    console.log(`\n  Upserting ${toInsert.length} videos...`);
    let upserted = 0;
    let errors = 0;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('vehicle_videos').upsert(batch, { onConflict: 'platform,video_id' });
      if (error) {
        console.error(`  Batch error at ${i}: ${error.message}`);
        errors++;
      } else {
        upserted += batch.length;
      }
    }
    console.log(`  Upserted: ${upserted} | Errors: ${errors}`);
    stats.inserted = upserted;
  }

  console.log('\n' + '='.repeat(60));
  console.log('  IMPORT YOUTUBE JSON RESULTS');
  console.log('='.repeat(60));
  console.log(`  Input: ${totalVideos} videos from ${vehicles.length} vehicles`);
  console.log(`  Matched: ${stats.matched}`);
  console.log(`  Skipped (existing): ${stats.skippedExisting}`);
  console.log(`  Unmatched: ${stats.unmatched}`);
  console.log(`  Inserted: ${DRY_RUN ? '(dry run)' : stats.inserted}`);
  console.log(`  Unique gens: ${genCounts.size}`);
  console.log('='.repeat(60));

  const reportPath = path.join(DATA_DIR, 'import-youtube-json-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    stats,
    uniqueGens: genCounts.size,
    totalInput: totalVideos,
  }, null, 2));
  console.log(`  Report: ${reportPath}`);
}

main().catch(console.error);
