/**
 * FLM AUTO — RAG Index Builder
 * Generates text documents for each generation and embeds them with Voyage AI
 * Stores embeddings in rag_documents table for semantic search by ALAIN
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/build-rag-index.ts
 *
 * Requires: VOYAGE_API_KEY in .env.local (or OPENAI_API_KEY as fallback)
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

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CHECKPOINT_FILE = path.resolve(__dirname, '../data/raw/checkpoint_rag_index.json');
const BATCH_SIZE = 50; // Generations per batch
const EMBED_BATCH_SIZE = 32; // Documents per embedding call
const DELAY_MS = 300;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Checkpoint ──────────────────────────────────────────

interface Checkpoint {
  processedIds: string[];
  totalDocuments: number;
  totalEmbedded: number;
  startedAt: string;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return { processedIds: [], totalDocuments: 0, totalEmbedded: 0, startedAt: new Date().toISOString() };
}

function saveCheckpoint(cp: Checkpoint): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ─── Embedding ───────────────────────────────────────────

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (VOYAGE_API_KEY) {
    return embedWithVoyage(texts);
  } else if (OPENAI_API_KEY) {
    return embedWithOpenAI(texts);
  }
  throw new Error('No embedding API key found. Set VOYAGE_API_KEY or OPENAI_API_KEY in .env.local');
}

async function embedWithVoyage(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'voyage-3-lite',
      input: texts,
      input_type: 'document',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voyage API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data.map((d: any) => d.embedding);
}

async function embedWithOpenAI(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
      dimensions: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data.map((d: any) => d.embedding);
}

// ─── Pagination helper ───────────────────────────────────

async function paginateAll(table: string, select: string): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

// ─── Document Generation ─────────────────────────────────

function buildVehicleDocument(gen: any): string {
  const brand = gen.models?.brands?.name || 'Unknown';
  const model = gen.models?.name || 'Unknown';
  const genName = gen.internal_code || gen.name || '';
  const chassis = gen.chassis_code ? ` (${gen.chassis_code})` : '';
  const startYear = gen.production_start ? new Date(gen.production_start).getFullYear() : '?';
  const endYear = gen.production_end ? new Date(gen.production_end).getFullYear() : 'présent';
  const body = gen.body_style || '';

  let doc = `${brand} ${model} ${genName}${chassis}\n`;
  doc += `Années: ${startYear}–${endYear}\n`;
  if (body) doc += `Carrosserie: ${body}\n`;

  // Variants/engines
  if (gen.engine_variants && gen.engine_variants.length > 0) {
    const engines = gen.engine_variants.slice(0, 5);
    doc += `Motorisations:\n`;
    for (const v of engines) {
      const pt = Array.isArray(v.powertrain_specs) ? v.powertrain_specs[0] : v.powertrain_specs;
      const perf = Array.isArray(v.performance_specs) ? v.performance_specs[0] : v.performance_specs;
      const name = v.name?.replace(/Specs$/, '').trim() || v.badge || '';
      const power = pt?.power_hp ? `${pt.power_hp} ch` : '';
      const torque = pt?.torque_nm ? `${pt.torque_nm} Nm` : '';
      const fuel = v.fuel_type || '';
      const accel = perf?.acceleration_0_100_kmh ? `0-100: ${perf.acceleration_0_100_kmh}s` : '';
      const speed = perf?.top_speed_kmh ? `Vmax: ${perf.top_speed_kmh} km/h` : '';
      doc += `- ${name} ${fuel} ${power} ${torque} ${accel} ${speed}\n`;
    }
    if (gen.engine_variants.length > 5) {
      doc += `  ... et ${gen.engine_variants.length - 5} autres motorisations\n`;
    }
  }

  // Safety
  if (gen.safety_ratings && gen.safety_ratings.length > 0) {
    const s = gen.safety_ratings[0];
    doc += `Sécurité Euro NCAP: ${s.stars}/5 étoiles`;
    if (s.adult_occupant_pct) doc += ` (adulte: ${s.adult_occupant_pct}%)`;
    if (s.child_occupant_pct) doc += ` (enfant: ${s.child_occupant_pct}%)`;
    doc += '\n';
  }

  // Interior dimensions
  if (gen.interior_dimensions && gen.interior_dimensions.length > 0) {
    const d = gen.interior_dimensions[0];
    if (d.trunk_volume_liters) doc += `Coffre: ${d.trunk_volume_liters} litres`;
    if (d.trunk_volume_max_liters) doc += ` (max: ${d.trunk_volume_max_liters} L)`;
    if (d.trunk_volume_liters) doc += '\n';
    if (d.seating_capacity) doc += `Places: ${d.seating_capacity}\n`;
  }

  // Family fit
  if (gen.family_fit_compatibility && gen.family_fit_compatibility.length > 0) {
    const f = gen.family_fit_compatibility[0];
    doc += `ISOFIX: ${f.isofix_points || 0} points`;
    if (f.three_across_possible) doc += ', 3 sièges auto possible';
    doc += '\n';
  }

  return doc.trim();
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('🧠 FLM AUTO — RAG Index Builder');

  if (!VOYAGE_API_KEY && !OPENAI_API_KEY) {
    console.error('❌ No embedding API key found. Set VOYAGE_API_KEY or OPENAI_API_KEY in .env.local');
    process.exit(1);
  }

  console.log(`📡 Using: ${VOYAGE_API_KEY ? 'Voyage AI' : 'OpenAI'} embeddings`);

  const checkpoint = loadCheckpoint();
  const processedSet = new Set(checkpoint.processedIds);

  console.log(`📂 Checkpoint: ${processedSet.size} already processed\n`);

  // Fetch ALL generations with related data
  console.log('📥 Fetching generations...');
  const generations = await paginateAll(
    'generations',
    'id, name, internal_code, chassis_code, body_style, production_start, production_end, ' +
    'models!inner(name, brands!inner(name)), ' +
    'engine_variants(name, badge, fuel_type, engine_code, powertrain_specs(power_hp, torque_nm), performance_specs(acceleration_0_100_kmh, top_speed_kmh)), ' +
    'safety_ratings(stars, adult_occupant_pct, child_occupant_pct, test_year), ' +
    'interior_dimensions(trunk_volume_liters, trunk_volume_max_liters, seating_capacity), ' +
    'family_fit_compatibility(isofix_points, three_across_possible)'
  );

  console.log(`📊 Total generations: ${generations.length}`);

  // Filter out already-processed
  const toProcess = generations.filter(g => !processedSet.has(g.id));
  console.log(`🔄 To process: ${toProcess.length}\n`);

  // Process in batches
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);

    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} generations)`);

    // Generate documents
    const documents: Array<{ generation_id: string; content: string; metadata: any }> = [];

    for (const gen of batch) {
      const doc = buildVehicleDocument(gen);
      const brand = gen.models?.brands?.name || '';
      const model = gen.models?.name || '';

      documents.push({
        generation_id: gen.id,
        content: doc,
        metadata: {
          brand,
          model,
          body_style: gen.body_style,
          has_safety: (gen.safety_ratings?.length || 0) > 0,
          has_dimensions: (gen.interior_dimensions?.length || 0) > 0,
          variant_count: gen.engine_variants?.length || 0,
        },
      });
    }

    // Embed in sub-batches
    for (let j = 0; j < documents.length; j += EMBED_BATCH_SIZE) {
      const embedBatch = documents.slice(j, j + EMBED_BATCH_SIZE);
      const texts = embedBatch.map(d => d.content);

      try {
        const embeddings = await embedTexts(texts);

        // Upsert into rag_documents
        const rows = embedBatch.map((d, idx) => ({
          generation_id: d.generation_id,
          content_type: 'vehicle_summary',
          content: d.content,
          metadata: d.metadata,
          embedding: JSON.stringify(embeddings[idx]),
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase.from('rag_documents').upsert(rows, {
          onConflict: 'generation_id,content_type',
        });

        if (error) {
          console.error(`  ⚠️  Upsert error: ${error.message}`);
        } else {
          checkpoint.totalEmbedded += embedBatch.length;
        }

        await delay(DELAY_MS);
      } catch (err: any) {
        console.error(`  ❌ Embedding error: ${err.message}`);
        // Save checkpoint and continue
        saveCheckpoint(checkpoint);
        if (err.message.includes('429') || err.message.includes('rate')) {
          console.log('  ⏳ Rate limited, waiting 30s...');
          await delay(30000);
        }
        continue;
      }
    }

    // Update checkpoint
    for (const gen of batch) {
      checkpoint.processedIds.push(gen.id);
    }
    checkpoint.totalDocuments += documents.length;
    saveCheckpoint(checkpoint);

    const pct = ((i + batch.length) / toProcess.length * 100).toFixed(1);
    console.log(`  ✅ ${pct}% — ${checkpoint.totalEmbedded} embedded total\n`);
  }

  console.log('🎉 RAG Index complete!');
  console.log(`📊 Total documents: ${checkpoint.totalDocuments}`);
  console.log(`📊 Total embedded: ${checkpoint.totalEmbedded}`);
}

main().catch(console.error);
