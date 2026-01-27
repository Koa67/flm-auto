/**
 * Import missing generations for IGCD matching
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

interface MissingGen {
  brand: string;
  model: string;
  generation: string;
  internal_code: string;
  years: string;
  notes: string;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Import Missing Generations for IGCD         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const dataPath = path.join(__dirname, '../data/missing_for_igcd.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  const missing: MissingGen[] = data.missing_generations;
  
  console.log(`Loaded ${missing.length} missing generation definitions\n`);

  // Get all brands
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map(brands?.map(b => [b.name, b.id]) || []);

  let modelsCreated = 0;
  let generationsCreated = 0;
  let skipped = 0;

  for (const mg of missing) {
    const brandId = brandMap.get(mg.brand);
    if (!brandId) {
      console.log(`✗ Brand not found: ${mg.brand}`);
      continue;
    }

    const [yearStart, yearEnd] = mg.years.split('-').map(y => parseInt(y) || null);

    // Check/create model
    let { data: existingModel } = await supabase
      .from('models')
      .select('id')
      .eq('brand_id', brandId)
      .eq('name', mg.model)
      .single();

    let modelId: string;

    if (!existingModel) {
      const slug = mg.model.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data: newModel, error: modelError } = await supabase
        .from('models')
        .insert({
          brand_id: brandId,
          name: mg.model,
          slug: slug
        })
        .select('id')
        .single();

      if (modelError) {
        console.error(`Error creating model ${mg.model}:`, modelError.message);
        continue;
      }
      modelId = newModel.id;
      modelsCreated++;
      console.log(`✓ Created model: ${mg.brand} ${mg.model}`);
    } else {
      modelId = existingModel.id;
    }

    // Check if generation exists
    const { data: existingGen } = await supabase
      .from('generations')
      .select('id')
      .eq('model_id', modelId)
      .eq('internal_code', mg.internal_code)
      .single();

    if (existingGen) {
      console.log(`  ⊘ ${mg.internal_code} exists`);
      skipped++;
      continue;
    }

    // Create generation
    const genSlug = mg.internal_code.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { error: genError } = await supabase
      .from('generations')
      .insert({
        model_id: modelId,
        name: mg.generation,
        slug: genSlug,
        internal_code: mg.internal_code,
        production_start: yearStart ? new Date(`${yearStart}-01-01`) : null,
        production_end: yearEnd && yearEnd < 2025 ? new Date(`${yearEnd}-12-31`) : null
      });

    if (genError) {
      console.error(`  Error ${mg.internal_code}:`, genError.message);
      continue;
    }

    generationsCreated++;
    console.log(`  ✓ ${mg.internal_code} (${mg.years})`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Models created: ${modelsCreated}`);
  console.log(`Generations created: ${generationsCreated}`);
  console.log(`Skipped: ${skipped}`);
  
  const { count } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true });
  console.log(`Total generations: ${count}`);
}

main().catch(console.error);
