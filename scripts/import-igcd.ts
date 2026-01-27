/**
 * Import curated IGCD game appearances into Supabase
 * Fixed: uses correct column names from schema
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GameAppearance {
  brand: string;
  model: string;
  generation: string | null;
  year: number;
  games: Array<{
    title: string;
    year: number;
    playable: boolean;
  }>;
}

// Model name aliases for matching
const MODEL_ALIASES: Record<string, string[]> = {
  'C-Class': ['C63 AMG', 'C63', 'C-Class'],
  'E-Class': ['E63 AMG', 'E63', 'E-Class'],
  'G-Class': ['G63 AMG', 'G63', 'G-Class', 'G'],
  'S-Class': ['S65 AMG', 'S63 AMG', 'S-Class'],
  'Murciélago': ['Murcielago', 'Murciélago'],
  'Huracán': ['Huracan', 'Huracán'],
  'Centenario': ['Centenario'],
};

function normalizeModelName(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '');
}

function modelsMatch(dbModel: string, searchModel: string): boolean {
  const dbNorm = normalizeModelName(dbModel);
  const searchNorm = normalizeModelName(searchModel);
  
  // Direct match
  if (dbNorm === searchNorm) return true;
  if (dbNorm.includes(searchNorm) || searchNorm.includes(dbNorm)) return true;
  
  // Check aliases
  for (const [canonical, aliases] of Object.entries(MODEL_ALIASES)) {
    const canonicalNorm = normalizeModelName(canonical);
    if (dbNorm === canonicalNorm || dbNorm.includes(canonicalNorm)) {
      for (const alias of aliases) {
        if (normalizeModelName(alias) === searchNorm) return true;
        if (searchNorm.includes(normalizeModelName(alias))) return true;
      }
    }
  }
  
  // Extract base model (first word)
  const dbBase = dbNorm.split(/[^a-z0-9]/)[0];
  const searchBase = searchNorm.split(/[^a-z0-9]/)[0];
  if (dbBase === searchBase && dbBase.length >= 2) return true;
  
  return false;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Import IGCD Game Appearances (v2)           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Load curated data
  const dataPath = path.join(__dirname, '../data/igcd/game_appearances_curated.json');
  const data: GameAppearance[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Loaded ${data.length} vehicles with game appearances`);

  // Get all generations from DB with full model info
  const { data: generations, error: genError } = await supabase
    .from('generations')
    .select(`
      id,
      name,
      internal_code,
      model_id,
      models!inner (
        id,
        name,
        brands!inner (id, name)
      )
    `);

  if (genError) {
    console.error('Error fetching generations:', genError);
    return;
  }

  console.log(`Found ${generations?.length || 0} generations in DB\n`);

  let matched = 0;
  let unmatched = 0;
  let totalAppearances = 0;
  const insertData: any[] = [];
  const unmatchedList: string[] = [];

  for (const vehicle of data) {
    // Normalize brand name
    const brandName = vehicle.brand === 'Mercedes-Benz' ? 'Mercedes-Benz' : vehicle.brand;
    
    // Find matching generation with flexible matching
    const gen = generations?.find(g => {
      const dbBrand = (g.models as any).brands.name;
      const dbModel = (g.models as any).name;
      const dbCode = g.internal_code?.toLowerCase() || '';
      const dbName = g.name?.toLowerCase() || '';
      
      // Brand must match
      if (dbBrand.toLowerCase() !== brandName.toLowerCase()) return false;
      
      // Use improved model matching with aliases
      if (!modelsMatch(dbModel, vehicle.model)) return false;
      
      // If we have a generation code, match it
      if (vehicle.generation) {
        const genCode = vehicle.generation.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');
        const dbCodeNorm = dbCode.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        const dbNameNorm = dbName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        
        return dbCodeNorm === genCode || 
               dbCodeNorm.includes(genCode) || 
               dbNameNorm.includes(genCode) ||
               genCode.includes(dbCodeNorm);
      }
      
      // No generation specified - match by model only
      return true;
    });

    if (gen) {
      console.log(`✓ ${vehicle.brand} ${vehicle.model} (${vehicle.generation || 'N/A'}) → ${gen.internal_code || gen.name}`);
      matched++;
      
      // Add each game appearance
      for (const game of vehicle.games) {
        insertData.push({
          generation_id: gen.id,
          vehicle_make: vehicle.brand,
          vehicle_model: vehicle.model,
          vehicle_year: vehicle.year,
          chassis_code: vehicle.generation,
          media_type: 'video_game',
          movie_title: game.title,  // Using movie_title for game title too
          movie_year: game.year,
          role_importance: game.playable ? 'star' : 'featured',  // playable = star role
          notes: game.playable ? 'Playable vehicle' : 'Non-playable',
          igcd_url: 'https://igcd.net',
          is_verified: true
        });
        totalAppearances++;
      }
    } else {
      console.log(`✗ ${vehicle.brand} ${vehicle.model} (${vehicle.generation || 'N/A'}) - no match`);
      unmatchedList.push(`${vehicle.brand} ${vehicle.model} (${vehicle.generation || 'N/A'})`);
      unmatched++;
    }
  }

  console.log(`\nMatched: ${matched}, Unmatched: ${unmatched}`);
  console.log(`Total game appearances to insert: ${totalAppearances}`);

  if (unmatchedList.length > 0) {
    console.log('\nUnmatched vehicles (need manual add to DB or curated dataset fix):');
    unmatchedList.forEach(v => console.log(`  - ${v}`));
  }

  if (insertData.length === 0) {
    console.log('\nNo data to insert.');
    return;
  }

  // Insert into vehicle_appearances table
  console.log('\nInserting game appearances...');
  
  // Insert in batches of 50
  const batchSize = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < insertData.length; i += batchSize) {
    const batch = insertData.slice(i, i + batchSize);
    
    const { data: insertedData, error } = await supabase
      .from('vehicle_appearances')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`Batch error:`, error.message);
      errors += batch.length;
    } else {
      inserted += insertedData?.length || 0;
    }
  }

  console.log(`\n✓ Inserted ${inserted} game appearances (${errors} errors)`);
  
  // Show final count
  const { count } = await supabase
    .from('vehicle_appearances')
    .select('*', { count: 'exact', head: true })
    .eq('media_type', 'video_game');
  
  console.log(`Total video game appearances in DB: ${count}`);
  console.log('Done!');
}

main().catch(console.error);
