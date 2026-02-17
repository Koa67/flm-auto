/**
 * FLM AUTO - Import Curated Screen Cars
 * Imports the manually curated list of iconic movie/TV vehicles
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

interface CuratedAppearance {
  vehicle_make: string;
  vehicle_model: string;
  chassis_code: string | null;
  vehicle_year: number | null;
  movie_title: string;
  movie_year: number;
  media_type: string;
  role_importance: string;
  notes: string;
  imdb_id?: string;
  igcd_id?: string;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       FLM AUTO - Import Curated Screen Cars                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Read curated data
  const dataPath = path.resolve(__dirname, '../data/imcdb/curated_screen_cars.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(rawData);
  
  console.log(`Loaded ${data.appearances.length} curated appearances`);
  console.log(`Brands: ${data.metadata.brands.join(', ')}`);
  
  // Check if table exists
  const { error: checkError } = await supabase
    .from('vehicle_appearances')
    .select('id')
    .limit(1);
  
  if (checkError && checkError.code === '42P01') {
    console.log('\n❌ Table vehicle_appearances does not exist.');
    console.log('Please run the migration first:');
    console.log('  1. Go to Supabase Dashboard > SQL Editor');
    console.log('  2. Paste contents of supabase/migrations/002_vehicle_appearances.sql');
    console.log('  3. Run the query');
    console.log('  4. Re-run this script');
    return;
  }
  
  // Prepare data for insert
  const rows = data.appearances.map((app: CuratedAppearance, idx: number) => ({
    imcdb_vehicle_id: `curated-${app.vehicle_make.toLowerCase()}-${idx}`,
    vehicle_year: app.vehicle_year,
    vehicle_make: app.vehicle_make,
    vehicle_model: app.vehicle_model,
    chassis_code: app.chassis_code,
    movie_title: app.movie_title,
    movie_year: app.movie_year,
    media_type: app.media_type,
    role_importance: app.role_importance,
    notes: app.notes,
    is_verified: true, // Curated = verified
    imcdb_url: app.imdb_id ? `https://www.imdb.com/title/${app.imdb_id}/` : null,
  }));
  
  // Group by brand for logging
  const byBrand: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  
  for (const row of rows) {
    byBrand[row.vehicle_make] = (byBrand[row.vehicle_make] || 0) + 1;
    byRole[row.role_importance] = (byRole[row.role_importance] || 0) + 1;
  }
  
  console.log('\nBy brand:');
  Object.entries(byBrand).forEach(([brand, count]) => {
    console.log(`  ${brand}: ${count}`);
  });
  
  console.log('\nBy role importance:');
  Object.entries(byRole).forEach(([role, count]) => {
    console.log(`  ${role}: ${count}`);
  });
  
  // Upsert to database
  console.log('\nInserting to Supabase...');
  
  const { data: inserted, error: insertError } = await supabase
    .from('vehicle_appearances')
    .upsert(rows, { 
      onConflict: 'imcdb_vehicle_id',
      ignoreDuplicates: false 
    })
    .select();
  
  if (insertError) {
    console.error('Error inserting:', insertError);
    return;
  }
  
  console.log(`\n✓ Inserted ${inserted?.length || rows.length} curated screen car appearances`);
  
  // Try to match to our generations
  console.log('\nMatching to existing generations...');
  
  let matched = 0;
  for (const row of rows) {
    // Try to find matching generation by chassis code
    if (row.chassis_code) {
      const { data: generations } = await supabase
        .from('generations')
        .select(`
          id,
          internal_code,
          models!inner (
            name,
            brands!inner (name)
          )
        `)
        .ilike('internal_code', `%${row.chassis_code}%`)
        .limit(1);
      
      if (generations && generations.length > 0) {
        const gen = generations[0];
        const brand = (gen.models as any)?.brands?.name;
        
        // Verify brand matches
        if (brand && brand.toLowerCase().includes(row.vehicle_make.toLowerCase().split('-')[0])) {
          const { error: updateError } = await supabase
            .from('vehicle_appearances')
            .update({ generation_id: gen.id })
            .eq('imcdb_vehicle_id', row.imcdb_vehicle_id);
          
          if (!updateError) {
            matched++;
          }
        }
      }
    }
  }
  
  console.log(`✓ Matched ${matched} appearances to existing generations`);
  
  // Sample of famous movies
  console.log('\n📽️ Sample iconic appearances:');
  const famous = [
    'GoldenEye', 'The Italian Job', 'The Wolf of Wall Street', 
    'Batman Begins', 'Ronin', 'Doctor Strange'
  ];
  
  for (const movie of famous) {
    const app = data.appearances.find((a: CuratedAppearance) => a.movie_title === movie);
    if (app) {
      console.log(`  • ${app.vehicle_year || '?'} ${app.vehicle_make} ${app.vehicle_model}`);
      console.log(`    → ${movie} (${app.movie_year}) [${app.role_importance}]`);
    }
  }
  
  console.log('\n✓ Import complete!');
}

main().catch(console.error);
