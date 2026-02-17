/**
 * FLM AUTO — YouTube Video Scraper via Invidious API
 * No API quota limits — uses public Invidious instances
 * Target: 2000+ videos linked to generations
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

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_youtube.json');
const DELAY_MS = 1000; // Be respectful to Invidious instances

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Multiple Invidious instances for failover
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://vid.puffyan.us',
  'https://invidious.nerdvpn.de',
];

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
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data));
}

async function searchInvidious(query: string, instanceIdx = 0): Promise<any[]> {
  if (instanceIdx >= INVIDIOUS_INSTANCES.length) return [];

  const instance = INVIDIOUS_INSTANCES[instanceIdx];
  const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort_by=relevance`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      // Try next instance
      return searchInvidious(query, instanceIdx + 1);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return searchInvidious(query, instanceIdx + 1);

    return data.filter((v: any) => v.type === 'video').slice(0, 5).map((v: any) => ({
      videoId: v.videoId,
      title: v.title,
      channelName: v.author,
      channelId: v.authorId,
      thumbnailUrl: v.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      durationSeconds: v.lengthSeconds,
      viewCount: v.viewCount,
      publishedAt: v.published ? new Date(v.published * 1000).toISOString() : null,
    }));
  } catch {
    return searchInvidious(query, instanceIdx + 1);
  }
}

function classifyVideoType(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('review')) return 'review';
  if (lower.includes('walkaround') || lower.includes('walk around')) return 'walkaround';
  if (lower.includes('comparison') || lower.includes('vs')) return 'comparison';
  if (lower.includes('commercial') || lower.includes('ad ') || lower.includes('advert')) return 'commercial';
  if (lower.includes('top speed') || lower.includes('0-100') || lower.includes('0-60') || lower.includes('acceleration')) return 'performance';
  if (lower.includes('interior') || lower.includes('cabin')) return 'interior';
  if (lower.includes('sound') || lower.includes('exhaust')) return 'sound';
  if (lower.includes('crash') || lower.includes('ncap')) return 'safety';
  return 'review';
}

function detectLanguage(title: string): string {
  // Simple heuristics
  if (/\p{Script=Han}/u.test(title)) return 'zh';
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(title)) return 'ja';
  if (/\p{Script=Hangul}/u.test(title)) return 'ko';
  if (/essai|revue|routière|français/i.test(title)) return 'fr';
  if (/prueba|revisión/i.test(title)) return 'es';
  if (/test|fahrbericht|erfahrung/i.test(title)) return 'de';
  return 'en';
}

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

async function ensureVideoTable(): Promise<boolean> {
  // Check if table exists
  const { data, error } = await supabase.from('vehicle_videos').select('id').limit(1);
  if (error?.code === 'PGRST205' || error?.message?.includes('vehicle_videos')) {
    console.log('Table vehicle_videos does not exist. Creating via SQL...');
    const { error: createErr } = await supabase.rpc('exec_sql', {
      sql: `CREATE TABLE IF NOT EXISTS vehicle_videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        generation_id UUID REFERENCES generations(id),
        platform VARCHAR(50) DEFAULT 'youtube',
        video_id VARCHAR(100) NOT NULL,
        title TEXT,
        channel_name VARCHAR(255),
        channel_id VARCHAR(100),
        thumbnail_url TEXT,
        duration_seconds INTEGER,
        view_count BIGINT,
        published_at TIMESTAMPTZ,
        video_type VARCHAR(50),
        language VARCHAR(10),
        source_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(platform, video_id)
      );`
    });
    if (createErr) {
      console.log('Cannot create table via RPC. Please run this SQL in Supabase SQL Editor:');
      console.log(`CREATE TABLE IF NOT EXISTS vehicle_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES generations(id),
  platform VARCHAR(50) DEFAULT 'youtube',
  video_id VARCHAR(100) NOT NULL,
  title TEXT, channel_name VARCHAR(255), channel_id VARCHAR(100),
  thumbnail_url TEXT, duration_seconds INTEGER, view_count BIGINT,
  published_at TIMESTAMPTZ, video_type VARCHAR(50), language VARCHAR(10),
  source_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, video_id)
);`);
      return false;
    }
  }
  return true;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FLM AUTO — YouTube Scraper (Invidious API)');
  console.log('═══════════════════════════════════════════════════════\n');

  // Check table
  const tableOk = await ensureVideoTable();
  if (!tableOk) {
    console.log('\nPlease create the vehicle_videos table first, then re-run.');
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

  // Prioritize models with most generations
  const modelsToProcess = models
    .filter(m => !processedSet.has(m.id))
    .map(m => ({ ...m, genCount: (gensByModel.get(m.id) || []).length }))
    .sort((a, b) => b.genCount - a.genCount);

  console.log(`\nProcessing ${modelsToProcess.length} models...\n`);

  const startTime = Date.now();
  let batchSaved = 0;

  for (let i = 0; i < modelsToProcess.length; i++) {
    const model = modelsToProcess[i];
    const brand = brandMap.get(model.brand_id);
    if (!brand) continue;

    const modelGens = gensByModel.get(model.id) || [];
    if (modelGens.length === 0) continue;

    // Build search query
    const query = `${brand.name} ${model.name} review`;

    const videos = await searchInvidious(query);

    if (videos.length > 0) {
      // Assign videos to most recent generation
      const sortedGens = modelGens.sort((a: any, b: any) => {
        const aSlug = a.slug || '';
        const bSlug = b.slug || '';
        return bSlug.localeCompare(aSlug);
      });
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
          published_at: v.publishedAt,
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
  console.log(`  Videos saved:    ${totalSaved}`);
  console.log(`  Errors:          ${errors}`);
  console.log(`  Duration:        ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
