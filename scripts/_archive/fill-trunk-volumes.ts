import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHECKPOINT_FILE = path.join(__dirname, '../data/trunk_volumes_checkpoint.json');

interface Checkpoint {
  processedIds: number[];
  updatedCount: number;
  insertedCount: number;
  lastProcessedAt: string;
}

interface TrunkData {
  min?: number;
  max?: number;
}

async function paginateAll(table: string, select: string, filters?: {column: string, op: string, value: any}[]) {
  const PAGE = 1000;
  let all: any[] = [];
  let page = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(page * PAGE, (page + 1) * PAGE - 1);
    if (filters) for (const f of filters) q = q.filter(f.column, f.op, f.value);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    page++;
  }
  return all;
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
  }
  return {
    processedIds: [],
    updatedCount: 0,
    insertedCount: 0,
    lastProcessedAt: new Date().toISOString()
  };
}

function saveCheckpoint(checkpoint: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

function parseTrunkVolume(specValue: string): TrunkData | null {
  if (!specValue) return null;
  
  // Clean up the value
  const cleaned = specValue.toLowerCase().trim();
  
  // Handle ranges like "420/1350 l", "420-1350", "420 / 1350 liters"
  const rangePatterns = [
    /(\d+(?:\.\d+)?)\s*[-\/]\s*(\d+(?:\.\d+)?)/,
  ];
  
  for (const pattern of rangePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return {
        min: parseFloat(match[1]),
        max: parseFloat(match[2])
      };
    }
  }
  
  // Handle single values like "420 l", "420L", "420 liters", "420 litres"
  const singlePattern = /(\d+(?:\.\d+)?)\s*(?:l|liters?|litres?)?/;
  const match = cleaned.match(singlePattern);
  if (match) {
    const value = parseFloat(match[1]);
    // Sanity check: trunk volumes are typically between 50 and 3000 liters
    if (value >= 50 && value <= 3000) {
      return { min: value };
    }
  }
  
  return null;
}

async function fillTrunkVolumes() {
  console.log('🚗 Starting trunk volume filler...\n');
  
  const checkpoint = loadCheckpoint();
  console.log(`📊 Checkpoint loaded: ${checkpoint.updatedCount} updated, ${checkpoint.insertedCount} inserted so far\n`);
  
  // Step 1: Get all interior_dimensions rows with NULL trunk_volume_liters
  console.log('📥 Fetching interior_dimensions rows with missing trunk_volume_liters...');
  const nullTrunkRows = await paginateAll(
    'interior_dimensions',
    'id, generation_id, trunk_volume_liters, trunk_volume_max_liters',
    [{ column: 'trunk_volume_liters', op: 'is', value: null }]
  );
  console.log(`Found ${nullTrunkRows.length} rows with NULL trunk_volume_liters\n`);
  
  // Step 2: Get all third_party_specs with trunk-related specs
  console.log('📥 Fetching trunk-related specs from third_party_specs...');
  const trunkSpecs = await paginateAll(
    'third_party_specs',
    'generation_id, spec_type, spec_value, source'
  );
  
  // Filter for trunk-related specs
  const trunkRelatedSpecs = trunkSpecs.filter(spec => {
    const type = (spec.spec_type || '').toLowerCase();
    return type.includes('trunk') || 
           type.includes('boot') || 
           type.includes('cargo') || 
           type.includes('luggage') || 
           type.includes('kofferraum');
  });
  
  console.log(`Found ${trunkRelatedSpecs.length} trunk-related specs in third_party_specs\n`);
  
  // Group specs by generation_id
  const specsByGeneration = new Map<number, any[]>();
  for (const spec of trunkRelatedSpecs) {
    if (!specsByGeneration.has(spec.generation_id)) {
      specsByGeneration.set(spec.generation_id, []);
    }
    specsByGeneration.get(spec.generation_id)!.push(spec);
  }
  
  // Step 3: Process existing interior_dimensions rows
  let processedCount = 0;
  let skippedCount = 0;
  
  for (const row of nullTrunkRows) {
    if (checkpoint.processedIds.includes(row.id)) {
      skippedCount++;
      continue;
    }
    
    const specs = specsByGeneration.get(row.generation_id);
    if (!specs || specs.length === 0) {
      checkpoint.processedIds.push(row.id);
      processedCount++;
      continue;
    }
    
    // Try to find trunk volume from specs
    let bestTrunkData: TrunkData | null = null;
    let bestSource = '';
    
    for (const spec of specs) {
      const trunkData = parseTrunkVolume(spec.spec_value);
      if (trunkData) {
        bestTrunkData = trunkData;
        bestSource = spec.source;
        break; // Take the first valid one
      }
    }
    
    if (bestTrunkData) {
      const updateData: any = {
        trunk_volume_liters: bestTrunkData.min
      };
      
      if (bestTrunkData.max) {
        updateData.trunk_volume_max_liters = bestTrunkData.max;
      }
      
      const { error } = await supabase
        .from('interior_dimensions')
        .update(updateData)
        .eq('id', row.id);
      
      if (error) {
        console.error(`❌ Error updating row ${row.id}:`, error.message);
      } else {
        checkpoint.updatedCount++;
        console.log(`✅ Updated row ${row.id} (gen ${row.generation_id}): ${bestTrunkData.min}${bestTrunkData.max ? '/' + bestTrunkData.max : ''} L (source: ${bestSource})`);
      }
    }
    
    checkpoint.processedIds.push(row.id);
    processedCount++;
    
    // Save checkpoint every 100 rows
    if (processedCount % 100 === 0) {
      checkpoint.lastProcessedAt = new Date().toISOString();
      saveCheckpoint(checkpoint);
      console.log(`💾 Checkpoint saved at ${processedCount} rows processed\n`);
    }
  }
  
  console.log(`\n✨ Processed ${processedCount} existing rows (${skippedCount} skipped from checkpoint)\n`);
  
  // Step 4: Find generations with trunk specs but NO interior_dimensions row
  console.log('🔍 Finding generations with trunk specs but no interior_dimensions row...');
  
  const allInteriorDims = await paginateAll('interior_dimensions', 'generation_id');
  const existingGenIds = new Set(allInteriorDims.map(row => row.generation_id));
  
  const missingGenIds = Array.from(specsByGeneration.keys()).filter(
    genId => !existingGenIds.has(genId)
  );
  
  console.log(`Found ${missingGenIds.length} generations with trunk specs but no interior_dimensions row\n`);
  
  // Step 5: Insert new rows for missing generations
  for (const genId of missingGenIds) {
    const specs = specsByGeneration.get(genId)!;
    
    let bestTrunkData: TrunkData | null = null;
    let bestSource = '';
    
    for (const spec of specs) {
      const trunkData = parseTrunkVolume(spec.spec_value);
      if (trunkData) {
        bestTrunkData = trunkData;
        bestSource = spec.source;
        break;
      }
    }
    
    if (bestTrunkData) {
      const insertData: any = {
        generation_id: genId,
        trunk_volume_liters: bestTrunkData.min
      };
      
      if (bestTrunkData.max) {
        insertData.trunk_volume_max_liters = bestTrunkData.max;
      }
      
      const { error } = await supabase
        .from('interior_dimensions')
        .insert(insertData);
      
      if (error) {
        console.error(`❌ Error inserting row for gen ${genId}:`, error.message);
      } else {
        checkpoint.insertedCount++;
        console.log(`➕ Inserted new row for gen ${genId}: ${bestTrunkData.min}${bestTrunkData.max ? '/' + bestTrunkData.max : ''} L (source: ${bestSource})`);
      }
    }
    
    // Save checkpoint every 100 inserts
    if (checkpoint.insertedCount % 100 === 0) {
      checkpoint.lastProcessedAt = new Date().toISOString();
      saveCheckpoint(checkpoint);
      console.log(`💾 Checkpoint saved at ${checkpoint.insertedCount} inserts\n`);
    }
  }
  
  // Final checkpoint save
  checkpoint.lastProcessedAt = new Date().toISOString();
  saveCheckpoint(checkpoint);
  
  // Step 6: Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Updated rows: ${checkpoint.updatedCount}`);
  console.log(`➕ Inserted rows: ${checkpoint.insertedCount}`);
  
  // Get final stats
  const allInteriorDimsFinal = await paginateAll('interior_dimensions', 'trunk_volume_liters');
  const totalRows = allInteriorDimsFinal.length;
  const filledRows = allInteriorDimsFinal.filter(row => row.trunk_volume_liters !== null).length;
  const missingRows = totalRows - filledRows;
  const coveragePercent = ((filledRows / totalRows) * 100).toFixed(1);
  
  console.log(`\n📈 Coverage Stats:`);
  console.log(`   Total interior_dimensions rows: ${totalRows}`);
  console.log(`   Rows with trunk_volume_liters: ${filledRows} (${coveragePercent}%)`);
  console.log(`   Still missing: ${missingRows}`);
  console.log('='.repeat(60) + '\n');
}

fillTrunkVolumes().catch(console.error);
