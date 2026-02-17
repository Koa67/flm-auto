/**
 * FLM AUTO — YouTube Video Scraper V3
 * Direct YouTube search (no Invidious/Piped dependency)
 * Target: 2000+ videos linked to generations
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-youtube-v3.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_youtube_v3.json');
const DELAY_MS = 2000; // Be respectful — YouTube can block if too fast

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface CheckpointData {
  processedModelIds: string[];
  totalSaved: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): CheckpointData {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return { processedModelIds: [], totalSaved: 0, errors: 0, startedAt: new Date().toISOString() };
}

function saveCheckpoint(data: CheckpointData): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── YouTube Search (direct scrape) ──────────────────────

async function searchYouTube(query: string): Promise<any[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const html = await res.text();

    // Extract ytInitialData JSON from the page
    const match = html.match(/var ytInitialData\s*=\s*(\{.*?\});\s*<\/script>/s);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

    const videos: any[] = [];
    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const vr = item.videoRenderer;
        if (!vr || !vr.videoId) continue;

        // Parse duration string "14:46" or "1:22:08"
        let durationSec = 0;
        const durText = vr.lengthText?.simpleText || '';
        const parts = durText.split(':').reverse();
        if (parts.length >= 2) {
          durationSec = parseInt(parts[0] || '0') + parseInt(parts[1] || '0') * 60;
          if (parts[2]) durationSec += parseInt(parts[2]) * 3600;
        }

        // Parse view count "1,156,422 views"
        let viewCount = 0;
        const viewText = vr.viewCountText?.simpleText || '';
        const viewMatch = viewText.replace(/,/g, '').match(/(\d+)/);
        if (viewMatch) viewCount = parseInt(viewMatch[1]);

        // Get best thumbnail
        const thumbs = vr.thumbnail?.thumbnails || [];
        const thumb = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;

        videos.push({
          videoId: vr.videoId,
          title: vr.title?.runs?.[0]?.text || '',
          channelName: vr.ownerText?.runs?.[0]?.text || '',
          channelId: vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '',
          thumbnailUrl: thumb,
          durationSeconds: durationSec,
          viewCount,
          // publishedAt from relative date text
          publishedText: vr.publishedTimeText?.simpleText || '',
        });
      }
    }

    return videos.slice(0, 5);
  } catch {
    return [];
  }
}

// ─── Video Classification ────────────────────────────────

function classifyVideoType(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('review')) return 'review';
  if (lower.includes('walkaround') || lower.includes('walk around') || lower.includes('tour')) return 'walkaround';
  if (lower.includes('comparison') || lower.includes(' vs ') || lower.includes('versus')) return 'comparison';
  if (lower.includes('commercial') || lower.includes('ad ') || lower.includes('advert')) return 'commercial';
  if (lower.includes('top speed') || lower.includes('0-100') || lower.includes('0-60') || lower.includes('acceleration') || lower.includes('autobahn')) return 'performance';
  if (lower.includes('interior') || lower.includes('cabin')) return 'interior';
  if (lower.includes('sound') || lower.includes('exhaust') || lower.includes('revving')) return 'sound';
  if (lower.includes('crash') || lower.includes('ncap') || lower.includes('safety')) return 'safety';
  if (lower.includes('buyer') || lower.includes('guide') || lower.includes('worth')) return 'buyer_guide';
  if (lower.includes('pov') || lower.includes('driving')) return 'pov_drive';
  return 'review';
}

function detectLanguage(title: string): string {
  if (/\p{Script=Han}/u.test(title)) return 'zh';
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(title)) return 'ja';
  if (/\p{Script=Hangul}/u.test(title)) return 'ko';
  if (/\p{Script=Arabic}/u.test(title)) return 'ar';
  if (/\p{Script=Cyrillic}/u.test(title)) return 'ru';
  if (/essai|revue|routière/i.test(title)) return 'fr';
  if (/prueba|revisión/i.test(title)) return 'es';
  if (/test|fahrbericht|erfahrung/i.test(title)) return 'de';
  return 'en';
}

// ─── DB Helpers ──────────────────────────────────────────

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — YouTube Scraper V3 (Direct Search)');
  console.log('═══════════════════════════════════════════════════════\n');

  // Check table
  const { error: tableErr } = await supabase.from('vehicle_videos').select('id').limit(1);
  if (tableErr) {
    console.log('ERROR: vehicle_videos table not found:', tableErr.message);
    return;
  }

  // Load DB data
  console.log('Loading DB data...');
  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name, brand_id');
  const gens = await paginateAll('generations', 'id, name, slug, chassis_code, model_id');
  console.log(`DB: ${brands.length} brands, ${models.length} models, ${gens.length} generations`);

  const brandMap = new Map(brands.map(b => [b.id, b]));
  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  // Checkpoint
  const checkpoint = loadCheckpoint();
  const processedSet = new Set(checkpoint.processedModelIds);
  let totalSaved = checkpoint.totalSaved;
  let errors = checkpoint.errors;

  if (processedSet.size > 0) {
    console.log(`Resuming: ${processedSet.size} models processed, ${totalSaved} saved`);
  }

  // Process models — prioritize by most generations
  const modelsToProcess = models
    .filter(m => !processedSet.has(m.id))
    .map(m => ({ ...m, genCount: (gensByModel.get(m.id) || []).length }))
    .sort((a, b) => b.genCount - a.genCount);

  console.log(`\nProcessing ${modelsToProcess.length} models...\n`);

  const startTime = Date.now();
  let batchSaved = 0;
  let consecutiveEmpty = 0;

  for (let i = 0; i < modelsToProcess.length; i++) {
    const model = modelsToProcess[i];
    const brand = brandMap.get(model.brand_id);
    if (!brand) continue;

    const modelGens = gensByModel.get(model.id) || [];
    if (modelGens.length === 0) continue;

    // Search YouTube
    const query = `${brand.name} ${model.name} review`;
    const videos = await searchYouTube(query);

    if (videos.length > 0) {
      consecutiveEmpty = 0;

      // Assign to most recent generation (by slug/name)
      const sortedGens = modelGens.sort((a: any, b: any) =>
        (b.slug || '').localeCompare(a.slug || '')
      );
      const targetGen = sortedGens[0];

      for (const v of videos) {
        const row = {
          generation_id: targetGen.id,
          platform: 'youtube',
          video_id: v.videoId,
          title: v.title,
          channel_name: v.channelName,
          channel_id: v.channelId,
          thumbnail_url: v.thumbnailUrl,
          duration_seconds: v.durationSeconds,
          view_count: v.viewCount,
          video_type: classifyVideoType(v.title),
          language: detectLanguage(v.title),
          source_url: `https://www.youtube.com/watch?v=${v.videoId}`,
        };

        const { error } = await supabase.from('vehicle_videos').insert(row);
        if (!error) {
          totalSaved++;
          batchSaved++;
        } else if (error.code !== '23505') { // Not a duplicate
          errors++;
        }
      }
    } else {
      consecutiveEmpty++;
      // If too many consecutive empty results, YouTube might be blocking us
      if (consecutiveEmpty >= 10) {
        console.log('   WARNING: 10 consecutive empty results. Adding extra delay...');
        await delay(10000);
        consecutiveEmpty = 0;
      }
    }

    processedSet.add(model.id);

    // Progress
    if ((i + 1) % 25 === 0 || i === modelsToProcess.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = modelsToProcess.length - i - 1;
      const eta = remaining / Math.max(rate, 0.01);
      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ` +
        `${i + 1}/${modelsToProcess.length} models | ` +
        `+${batchSaved} videos (total: ${totalSaved}) | ` +
        `Errors: ${errors} | ` +
        `ETA: ${Math.floor(eta / 60)}m${Math.floor(eta % 60)}s`
      );
    }

    // Checkpoint every 50
    if ((i + 1) % 50 === 0) {
      saveCheckpoint({
        processedModelIds: [...processedSet],
        totalSaved, errors,
        startedAt: checkpoint.startedAt,
      });
    }

    await delay(DELAY_MS);
  }

  // Final checkpoint
  saveCheckpoint({
    processedModelIds: [...processedSet],
    totalSaved, errors,
    startedAt: checkpoint.startedAt,
  });

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  YOUTUBE SCRAPING COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Models processed: ${processedSet.size}`);
  console.log(`  Videos saved:     ${totalSaved}`);
  console.log(`  Errors:           ${errors}`);
  console.log(`  Duration:         ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
