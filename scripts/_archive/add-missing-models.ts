/**
 * FLM AUTO - Add missing models for TÜV matching
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const MISSING_MODELS = [
  // Mercedes-Benz
  { brand: 'Mercedes-Benz', model: 'GLC', body_types: ['SUV'], years: [2015, null] },
  { brand: 'Mercedes-Benz', model: 'GLK', body_types: ['SUV'], years: [2008, 2015] },
  { brand: 'Mercedes-Benz', model: 'CLS', body_types: ['Sedan', 'Shooting Brake'], years: [2004, null] },
  
  // Tesla
  { brand: 'Tesla', model: 'Model 3', body_types: ['Sedan'], years: [2017, null] },
  { brand: 'Tesla', model: 'Model S', body_types: ['Sedan'], years: [2012, null] },
  { brand: 'Tesla', model: 'Model X', body_types: ['SUV'], years: [2015, null] },
  { brand: 'Tesla', model: 'Model Y', body_types: ['SUV'], years: [2020, null] },
  
  // Hyundai
  { brand: 'Hyundai', model: 'i10', body_types: ['Hatchback'], years: [2007, null] },
  { brand: 'Hyundai', model: 'i20', body_types: ['Hatchback'], years: [2008, null] },
  { brand: 'Hyundai', model: 'i30', body_types: ['Hatchback', 'Wagon'], years: [2007, null] },
  { brand: 'Hyundai', model: 'ix20', body_types: ['MPV'], years: [2010, 2019] },
  { brand: 'Hyundai', model: 'ix35', body_types: ['SUV'], years: [2009, 2015] },
  { brand: 'Hyundai', model: 'Tucson', body_types: ['SUV'], years: [2004, null] },
  { brand: 'Hyundai', model: 'Kona', body_types: ['SUV'], years: [2017, null] },
  { brand: 'Hyundai', model: 'Kona Electric', body_types: ['SUV'], years: [2018, null] },
  { brand: 'Hyundai', model: 'Ioniq', body_types: ['Hatchback'], years: [2016, 2022] },
  { brand: 'Hyundai', model: 'Ioniq 5', body_types: ['SUV'], years: [2021, null] },
  { brand: 'Hyundai', model: 'Ioniq 6', body_types: ['Sedan'], years: [2022, null] },
  { brand: 'Hyundai', model: 'Santa Fe', body_types: ['SUV'], years: [2000, null] },
  
  // Volvo
  { brand: 'Volvo', model: 'XC40', body_types: ['SUV'], years: [2017, null] },
  { brand: 'Volvo', model: 'XC60', body_types: ['SUV'], years: [2008, null] },
  { brand: 'Volvo', model: 'XC90', body_types: ['SUV'], years: [2002, null] },
  { brand: 'Volvo', model: 'V40', body_types: ['Hatchback'], years: [2012, 2019] },
  { brand: 'Volvo', model: 'V60', body_types: ['Wagon'], years: [2010, null] },
  { brand: 'Volvo', model: 'V90', body_types: ['Wagon'], years: [2016, null] },
  { brand: 'Volvo', model: 'S60', body_types: ['Sedan'], years: [2000, null] },
  { brand: 'Volvo', model: 'S90', body_types: ['Sedan'], years: [2016, null] },
  { brand: 'Volvo', model: 'C40', body_types: ['SUV'], years: [2021, null] },
  { brand: 'Volvo', model: 'EX30', body_types: ['SUV'], years: [2023, null] },
  { brand: 'Volvo', model: 'EX90', body_types: ['SUV'], years: [2024, null] },
  
  // Volkswagen (missing)
  { brand: 'Volkswagen', model: 'Golf Plus', body_types: ['MPV'], years: [2004, 2014] },
  { brand: 'Volkswagen', model: 'Golf Sportsvan', body_types: ['MPV'], years: [2014, 2020] },
  { brand: 'Volkswagen', model: 'e-Golf', body_types: ['Hatchback'], years: [2014, 2020] },
  { brand: 'Volkswagen', model: 'e-Up!', body_types: ['Hatchback'], years: [2013, 2023] },
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('🚀 FLM AUTO - Add Missing Models\n');
  
  // Get brands
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map(brands?.map(b => [b.name, b.id]) || []);
  
  console.log(`📋 Brands: ${[...brandMap.keys()].join(', ')}\n`);
  
  let added = 0;
  let skipped = 0;
  
  for (const item of MISSING_MODELS) {
    const brandId = brandMap.get(item.brand);
    if (!brandId) {
      console.log(`⚠️ Brand not found: ${item.brand}`);
      continue;
    }
    
    // Check if model exists
    const { data: existing } = await supabase
      .from('models')
      .select('id, name')
      .eq('brand_id', brandId)
      .ilike('name', item.model);
    
    if (existing && existing.length > 0) {
      console.log(`⏭️ Exists: ${item.brand} ${item.model}`);
      skipped++;
      continue;
    }
    
    // Insert model
    const modelSlug = slugify(`${item.brand}-${item.model}`);
    const { data: newModel, error: modelError } = await supabase
      .from('models')
      .insert({
        brand_id: brandId,
        name: item.model,
        slug: modelSlug,
      })
      .select()
      .single();
    
    if (modelError) {
      console.error(`❌ Error adding ${item.brand} ${item.model}:`, modelError.message);
      continue;
    }
    
    console.log(`✅ Added model: ${item.brand} ${item.model}`);
    
    // Add default generation
    const genSlug = slugify(`${item.model}-${item.years[0] || 'current'}`);
    const { error: genError } = await supabase
      .from('generations')
      .insert({
        model_id: newModel.id,
        name: item.years[1] ? `${item.years[0]}-${item.years[1]}` : `${item.years[0]}-present`,
        slug: genSlug,
        production_start: item.years[0],
        production_end: item.years[1],
        body_style: item.body_types[0],
      });
    
    if (genError) {
      console.error(`  ⚠️ Generation error:`, genError.message);
    } else {
      console.log(`   + Generation: ${item.years[0]}-${item.years[1] || 'present'}`);
    }
    
    added++;
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Added: ${added}`);
  console.log(`   ⏭️ Skipped: ${skipped}`);
  
  // Verify counts
  const { count: modelCount } = await supabase
    .from('models')
    .select('*', { count: 'exact', head: true });
  
  const { count: genCount } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 DB totals:`);
  console.log(`   Models: ${modelCount}`);
  console.log(`   Generations: ${genCount}`);
}

main().catch(console.error);
