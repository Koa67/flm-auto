/**
 * FLM AUTO — Mega YouTube Scraper
 * Searches multiple query templates per model for broader coverage
 * Target: 5,471 → 15,000+ videos
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/mega-youtube-scraper.ts
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_mega_youtube.json');
const DELAY_MS = 2500; // Polite: 2.5s between YouTube requests
const MAX_VIDEOS_PER_QUERY = 5;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Search Templates ──────────────────────────────────────

const SEARCH_TEMPLATES = [
  '{brand} {model} review',
  '{brand} {model} test drive',
  '{brand} {model} walkaround',
  '{brand} {model} interior',
  '{brand} {model} 0-100',
  '{brand} {model} crash test euro ncap',
  '{brand} {model} vs',
  '{brand} {model} buying guide',
  '{brand} {model} sound exhaust',
  '{brand} {model} POV driving',
];

// ─── Checkpoint ────────────────────────────────────────────

interface Checkpoint {
  processedModelTemplates: string[]; // "modelId:templateIndex"
  totalSaved: number;
  totalDupes: number;
  errors: number;
  startedAt: string;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    processedModelTemplates: [],
    totalSaved: 0,
    totalDupes: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
  };
}

function saveCheckpoint(data: Checkpoint): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── YouTube Search ────────────────────────────────────────

interface YouTubeResult {
  videoId: string;
  title: string;
  channelName: string;
  channelId: string;
  thumbnailUrl: string;
  durationSeconds: number;
  viewCount: number;
  publishedText: string;
}

async function searchYouTube(query: string): Promise<YouTubeResult[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const html = await res.text();

    const match = html.match(/var ytInitialData\s*=\s*(\{.*?\});\s*<\/script>/s);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents || [];

    const videos: YouTubeResult[] = [];
    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const vr = item.videoRenderer;
        if (!vr?.videoId) continue;

        let durationSeconds = 0;
        const durText = vr.lengthText?.simpleText || '';
        const parts = durText.split(':').reverse();
        if (parts.length >= 2) {
          durationSeconds =
            parseInt(parts[0] || '0') +
            parseInt(parts[1] || '0') * 60 +
            (parts[2] ? parseInt(parts[2]) * 3600 : 0);
        }

        let viewCount = 0;
        const viewText = vr.viewCountText?.simpleText || '';
        const viewMatch = viewText.replace(/,/g, '').match(/(\d+)/);
        if (viewMatch) viewCount = parseInt(viewMatch[1]);

        const thumbs = vr.thumbnail?.thumbnails || [];
        const thumb =
          thumbs[thumbs.length - 1]?.url ||
          `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;

        videos.push({
          videoId: vr.videoId,
          title: vr.title?.runs?.[0]?.text || '',
          channelName: vr.ownerText?.runs?.[0]?.text || '',
          channelId:
            vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint
              ?.browseId || '',
          thumbnailUrl: thumb,
          durationSeconds,
          viewCount,
          publishedText: vr.publishedTimeText?.simpleText || '',
        });
      }
    }

    return videos.slice(0, MAX_VIDEOS_PER_QUERY);
  } catch {
    return [];
  }
}

// ─── Classification ────────────────────────────────────────

function classifyVideoType(title: string, template: string): string {
  const lower = title.toLowerCase();
  if (template.includes('crash test')) return 'safety';
  if (template.includes('0-100')) return 'performance';
  if (template.includes('sound')) return 'sound';
  if (template.includes('interior')) return 'interior';
  if (template.includes('walkaround')) return 'walkaround';
  if (template.includes('test drive')) return 'test_drive';
  if (template.includes('vs')) return 'comparison';
  if (template.includes('buying guide')) return 'buyer_guide';
  if (template.includes('POV')) return 'pov_drive';
  if (lower.includes('review')) return 'review';
  return 'review';
}

function detectLanguage(title: string): string {
  if (/\p{Script=Han}/u.test(title)) return 'zh';
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(title)) return 'ja';
  if (/\p{Script=Hangul}/u.test(title)) return 'ko';
  if (/\p{Script=Cyrillic}/u.test(title)) return 'ru';
  if (/essai|revue|routière/i.test(title)) return 'fr';
  if (/prueba|revisión/i.test(title)) return 'es';
  if (/test|fahrbericht/i.test(title)) return 'de';
  return 'en';
}

// ─── DB Helpers ────────────────────────────────────────────

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from(table)
      .select(select)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — Mega YouTube Scraper');
  console.log(`  ${SEARCH_TEMPLATES.length} templates per model`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Verify table
  const { error: tableErr } = await supabase
    .from('vehicle_videos')
    .select('id')
    .limit(1);
  if (tableErr) {
    console.error('vehicle_videos table not found:', tableErr.message);
    return;
  }

  // Load DB
  console.log('Loading DB...');
  const brands = await paginateAll('brands', 'id, name');
  const models = await paginateAll('models', 'id, name, brand_id');
  const gens = await paginateAll(
    'generations',
    'id, name, slug, chassis_code, model_id'
  );
  console.log(
    `  ${brands.length} brands, ${models.length} models, ${gens.length} generations`
  );

  const brandMap = new Map(brands.map((b: any) => [b.id, b]));
  const gensByModel = new Map<string, any[]>();
  for (const g of gens) {
    if (!gensByModel.has(g.model_id)) gensByModel.set(g.model_id, []);
    gensByModel.get(g.model_id)!.push(g);
  }

  // Checkpoint
  const checkpoint = loadCheckpoint();
  const processedSet = new Set(checkpoint.processedModelTemplates);
  let { totalSaved, totalDupes, errors } = checkpoint;

  if (processedSet.size > 0) {
    console.log(
      `Resuming: ${processedSet.size} model+template combos done, ${totalSaved} saved\n`
    );
  }

  // Sort models by # of generations (prioritize popular models)
  const sortedModels = models
    .map((m: any) => ({
      ...m,
      genCount: (gensByModel.get(m.id) || []).length,
    }))
    .sort((a: any, b: any) => b.genCount - a.genCount);

  const totalCombos = sortedModels.length * SEARCH_TEMPLATES.length;
  const remainingCombos = sortedModels.reduce(
    (acc: number, m: any) =>
      acc +
      SEARCH_TEMPLATES.filter(
        (_, ti) => !processedSet.has(`${m.id}:${ti}`)
      ).length,
    0
  );

  console.log(
    `Total combos: ${totalCombos} | Remaining: ${remainingCombos}\n`
  );

  const startTime = Date.now();
  let consecutiveEmpty = 0;
  let processed = 0;

  for (const model of sortedModels) {
    const brand = brandMap.get(model.brand_id);
    if (!brand) continue;

    const modelGens = gensByModel.get(model.id) || [];
    if (modelGens.length === 0) continue;

    // Most recent generation (by slug alphabetically)
    const sortedGens = [...modelGens].sort((a: any, b: any) =>
      (b.slug || '').localeCompare(a.slug || '')
    );
    const targetGen = sortedGens[0];

    for (let ti = 0; ti < SEARCH_TEMPLATES.length; ti++) {
      const key = `${model.id}:${ti}`;
      if (processedSet.has(key)) continue;

      const template = SEARCH_TEMPLATES[ti];
      const query = template
        .replace('{brand}', brand.name)
        .replace('{model}', model.name);

      const videos = await searchYouTube(query);

      if (videos.length > 0) {
        consecutiveEmpty = 0;

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
            video_type: classifyVideoType(v.title, template),
            language: detectLanguage(v.title),
            source_url: `https://www.youtube.com/watch?v=${v.videoId}`,
          };

          const { error } = await supabase
            .from('vehicle_videos')
            .insert(row);
          if (!error) {
            totalSaved++;
          } else if (error.code === '23505') {
            totalDupes++;
          } else {
            errors++;
          }
        }
      } else {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 15) {
          console.log(
            '  ⚠️ 15 consecutive empty results. Cooling down 30s...'
          );
          await delay(30000);
          consecutiveEmpty = 0;
        }
      }

      processedSet.add(key);
      processed++;

      // Progress every 50 combos
      if (processed % 50 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = remainingCombos - processed;
        const eta = remaining / Math.max(rate, 0.01);
        console.log(
          `[${new Date().toISOString().slice(11, 19)}] ` +
            `${processed}/${remainingCombos} | ` +
            `${brand.name} ${model.name} | ` +
            `Saved: ${totalSaved} Dupes: ${totalDupes} Errors: ${errors} | ` +
            `ETA: ${Math.floor(eta / 60)}m`
        );
      }

      // Checkpoint every 100 combos
      if (processed % 100 === 0) {
        saveCheckpoint({
          processedModelTemplates: [...processedSet],
          totalSaved,
          totalDupes,
          errors,
          startedAt: checkpoint.startedAt,
        });
      }

      await delay(DELAY_MS);
    }
  }

  // Final checkpoint
  saveCheckpoint({
    processedModelTemplates: [...processedSet],
    totalSaved,
    totalDupes,
    errors,
    startedAt: checkpoint.startedAt,
  });

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  MEGA YOUTUBE SCRAPER — COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Combos processed: ${processed}`);
  console.log(`  Videos saved:     ${totalSaved}`);
  console.log(`  Duplicates:       ${totalDupes}`);
  console.log(`  Errors:           ${errors}`);
  console.log(
    `  Duration:         ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`
  );
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
