/**
 * FLM AUTO - Import Euro NCAP Safety Ratings to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface EuroNCAPRating {
  euroncap_id: string;
  make: string;
  model: string;
  test_year: number;
  stars: number;
  adult_occupant_pct: number;
  child_occupant_pct: number;
  pedestrian_pct: number;
  safety_assist_pct: number;
  url: string;
}

async function importSafetyRatings(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Import Euro NCAP Safety Ratings             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Load curated data
  const dataPath = path.join(process.cwd(), 'data', 'euroncap', 'safety_ratings_curated.json');
  const ratings: EuroNCAPRating[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  
  console.log(`Loaded ${ratings.length} safety ratings\n`);
  
  // Get all generations from DB to match
  const { data: generations, error: genError } = await supabase
    .from('generations')
    .select(`
      id,
      name,
      models!inner(
        id,
        name,
        brands!inner(name)
      )
    `);
  
  if (genError) {
    console.error('Error fetching generations:', genError);
    return;
  }
  
  console.log(`Found ${generations?.length || 0} generations in DB\n`);
  
  let matched = 0;
  let unmatched = 0;
  
  // Use Map to dedupe by generation_id (keep most recent test)
  const insertsMap = new Map<string, any>();
  
  for (const rating of ratings) {
    const brandName = rating.make;
    const modelName = rating.model;
    
    // Find matching generation - be more specific, avoid "Default"
    const matches = generations?.filter(gen => {
      const genBrand = (gen.models as any).brands?.name;
      const genModel = (gen.models as any).name;
      
      // Brand match
      if (genBrand !== brandName) return false;
      
      // Model match
      const normalizedModel = modelName.toLowerCase()
        .replace(/[-\s]/g, '')
        .replace(/class$/, '');
      const normalizedGenModel = genModel.toLowerCase()
        .replace(/[-\s]/g, '')
        .replace(/class$/, '');
      
      return normalizedGenModel === normalizedModel ||
        normalizedGenModel.includes(normalizedModel) ||
        normalizedModel.includes(normalizedGenModel);
    }) || [];
    
    // Prefer non-Default generation if available
    let match = matches.find(m => m.name !== 'Default') || matches[0];
    
    if (match) {
      matched++;
      
      // Only keep if newer than existing entry for same generation
      const existing = insertsMap.get(match.id);
      if (!existing || rating.test_year > existing.test_year) {
        insertsMap.set(match.id, {
          generation_id: match.id,
          euroncap_id: rating.euroncap_id,
          source_url: rating.url,
          stars: rating.stars,
          adult_occupant_pct: rating.adult_occupant_pct,
          child_occupant_pct: rating.child_occupant_pct,
          pedestrian_pct: rating.pedestrian_pct,
          safety_assist_pct: rating.safety_assist_pct,
          test_year: rating.test_year
        });
      }
      
      const genInfo = match.name !== 'Default' ? match.name : `${(match.models as any).name}`;
      console.log(`✓ ${rating.make} ${rating.model} (${rating.test_year}) → ${genInfo}`);
    } else {
      unmatched++;
      console.log(`✗ ${rating.make} ${rating.model} (${rating.test_year}) - no match found`);
    }
  }
  
  const inserts = Array.from(insertsMap.values());
  
  console.log(`\nMatched: ${matched}, Unmatched: ${unmatched}`);
  console.log(`Unique generations to insert: ${inserts.length}\n`);
  
  if (inserts.length === 0) {
    console.log('No ratings to import.');
    return;
  }
  
  // Insert one by one to handle conflicts gracefully
  console.log(`Inserting ${inserts.length} safety ratings...`);
  let inserted = 0;
  let errors = 0;
  
  for (const insert of inserts) {
    const { error } = await supabase
      .from('safety_ratings')
      .upsert(insert, { onConflict: 'generation_id' });
    
    if (error) {
      console.error(`  Error for generation ${insert.generation_id}:`, error.message);
      errors++;
    } else {
      inserted++;
    }
  }
  
  console.log(`\n✓ Inserted/updated ${inserted} ratings (${errors} errors)`);
  
  console.log('\n============================================================');
  console.log('IMPORT COMPLETE');
  console.log('============================================================');
  console.log(`Total ratings in file: ${ratings.length}`);
  console.log(`Matched to generations: ${matched}`);
  console.log(`Unique generations: ${inserts.length}`);
  console.log(`Successfully imported: ${inserted}`);
  console.log('\n✓ Done!');
}

importSafetyRatings().catch(console.error);
