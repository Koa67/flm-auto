/**
 * Import missing Mercedes models/generations into DB
 * These are needed for Euro NCAP matching
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

interface MissingModel {
  brand: string;
  model: string;
  generation: string;
  internal_code: string;
  years: string;
  body_types: string[];
  euro_ncap_year?: number;
  euro_ncap_stars?: number;
  drivetrain?: string;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Import Missing Mercedes Generations         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Load missing models data
  const dataPath = path.join(__dirname, '../data/mercedes_missing_models.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const missingModels: MissingModel[] = data.mercedes_missing_models;
  
  console.log(`Loaded ${missingModels.length} missing model definitions\n`);

  // Get Mercedes brand ID
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id')
    .eq('name', 'Mercedes-Benz')
    .single();

  if (brandError || !brand) {
    console.error('Could not find Mercedes-Benz brand:', brandError);
    return;
  }

  console.log(`Mercedes-Benz brand ID: ${brand.id}\n`);

  // First, check what columns exist in models table
  const { data: sampleModel } = await supabase
    .from('models')
    .select('*')
    .limit(1)
    .single();
  
  if (sampleModel) {
    console.log('Models table columns:', Object.keys(sampleModel).join(', '));
  }

  let modelsCreated = 0;
  let generationsCreated = 0;
  let skipped = 0;

  for (const mm of missingModels) {
    // Parse years
    const [yearStart, yearEnd] = mm.years.split('-').map(y => parseInt(y) || null);
    
    // Check if model exists
    let { data: existingModel } = await supabase
      .from('models')
      .select('id')
      .eq('brand_id', brand.id)
      .eq('name', mm.model)
      .single();

    let modelId: string;

    if (!existingModel) {
      // Create model with required fields including slug
      const slug = mm.model.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data: newModel, error: modelError } = await supabase
        .from('models')
        .insert({
          brand_id: brand.id,
          name: mm.model,
          slug: slug
        })
        .select('id')
        .single();

      if (modelError) {
        console.error(`Error creating model ${mm.model}:`, modelError);
        continue;
      }
      modelId = newModel.id;
      modelsCreated++;
      console.log(`✓ Created model: ${mm.model}`);
    } else {
      modelId = existingModel.id;
      console.log(`  Model exists: ${mm.model}`);
    }

    // Check if generation exists
    const { data: existingGen } = await supabase
      .from('generations')
      .select('id')
      .eq('model_id', modelId)
      .eq('internal_code', mm.internal_code)
      .single();

    if (existingGen) {
      console.log(`  ⊘ Generation ${mm.internal_code} already exists`);
      skipped++;
      continue;
    }

    // Create generation
    const genSlug = mm.internal_code.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { error: genError } = await supabase
      .from('generations')
      .insert({
        model_id: modelId,
        name: mm.generation,
        slug: genSlug,
        internal_code: mm.internal_code,
        production_start: yearStart ? new Date(`${yearStart}-01-01`) : null,
        production_end: yearEnd && yearEnd < 2025 ? new Date(`${yearEnd}-12-31`) : null
      });

    if (genError) {
      console.error(`  Error creating generation ${mm.internal_code}:`, genError);
      continue;
    }

    generationsCreated++;
    console.log(`  ✓ Created generation: ${mm.internal_code} (${mm.years})`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Models created: ${modelsCreated}`);
  console.log(`Generations created: ${generationsCreated}`);
  console.log(`Skipped (already exist): ${skipped}`);

  // Verify final count
  const { count } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal generations in DB: ${count}`);
  console.log('Done!');
}

main().catch(console.error);
