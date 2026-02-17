/**
 * FLM AUTO - Import new brands (Audi, Porsche, VW) to Supabase
 * Uses same structure as existing BMW/Mercedes/Lamborghini
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ScrapedVehicle {
  brand: string;
  model: string;
  variant: string;
  generation: string | null;
  year_start: number | null;
  displacement_cc: number | null;
  power_hp: number | null;
  power_kw: number | null;
  torque_nm: number | null;
  acceleration_0_100: number | null;
  top_speed_kmh: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  wheelbase_mm: number | null;
  trunk_volume_l: number | null;
  curb_weight_kg: number | null;
  drivetrain: string | null;
  transmission: string | null;
  fuel_consumption_l100km: number | null;
  co2_gkm: number | null;
  source_url: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

// Extract model name from variant
function extractModelName(variant: string, brand: string): string {
  // Remove brand prefix
  let name = variant.replace(new RegExp(`^${brand}\\s*`, 'i'), '').trim();
  
  // Extract first word or model code
  const patterns = [
    /^(A\d|Q\d|RS\d?|S\d|TT|R8|e-tron)/i,  // Audi: A4, Q5, RS6, TT, R8
    /^(\d{3}|Cayenne|Panamera|Macan|Taycan|Boxster|Cayman)/i, // Porsche
    /^(Golf|Passat|Polo|Tiguan|Touareg|Arteon|ID\.\d|Jetta|Beetle)/i, // VW
  ];
  
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) return match[1];
  }
  
  // Fallback: first word
  return name.split(/\s+/)[0] || 'Unknown';
}

// Extract generation/chassis code
function extractGeneration(variant: string, genField: string | null): string {
  // Try from generation field first
  if (genField) {
    const cleaned = genField.replace(/[()]/g, ' ').trim();
    if (cleaned.length > 1) return cleaned;
  }
  
  // Try to extract from variant
  const patterns = [
    /\(([A-Z0-9]+)\)/i,  // (8Z), (B8), etc.
    /\b([A-Z]\d{1,2})\b/, // B8, C7
    /\b(Mk\s*[IVX\d]+)\b/i,
  ];
  
  for (const p of patterns) {
    const m = variant.match(p);
    if (m) return m[1];
  }
  
  return 'Default';
}

async function importBrand(brandName: string, vehicles: ScrapedVehicle[]) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Importing ${brandName}: ${vehicles.length} vehicles`);
  console.log('─'.repeat(50));

  // 1. Create or get brand
  let { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('name', brandName)
    .single();

  if (!brand) {
    const { data: newBrand, error } = await supabase
      .from('brands')
      .insert({
        name: brandName,
        slug: slugify(brandName),
      })
      .select('id')
      .single();

    if (error) {
      console.error(`   ❌ Failed to create brand: ${error.message}`);
      return;
    }
    brand = newBrand;
    console.log(`   ✅ Created brand: ${brandName}`);
  } else {
    console.log(`   ℹ️  Brand exists: ${brandName}`);
  }

  // 2. Group vehicles by model
  const modelGroups = new Map<string, ScrapedVehicle[]>();
  
  for (const v of vehicles) {
    const modelName = extractModelName(v.variant, brandName);
    if (!modelGroups.has(modelName)) {
      modelGroups.set(modelName, []);
    }
    modelGroups.get(modelName)!.push(v);
  }

  console.log(`   Found ${modelGroups.size} unique models`);

  let modelsCreated = 0;
  let generationsCreated = 0;
  let variantsCreated = 0;

  // 3. Process each model
  for (const [modelName, modelVehicles] of modelGroups) {
    // Create or get model
    let { data: model } = await supabase
      .from('models')
      .select('id')
      .eq('brand_id', brand.id)
      .eq('name', modelName)
      .single();

    if (!model) {
      const { data: newModel, error } = await supabase
        .from('models')
        .insert({
          brand_id: brand.id,
          name: modelName,
          slug: slugify(`${brandName}-${modelName}`),
        })
        .select('id')
        .single();

      if (error) continue;
      model = newModel;
      modelsCreated++;
    }

    // Group by generation
    const genGroups = new Map<string, ScrapedVehicle[]>();
    
    for (const v of modelVehicles) {
      const gen = extractGeneration(v.variant, v.generation);
      if (!genGroups.has(gen)) {
        genGroups.set(gen, []);
      }
      genGroups.get(gen)!.push(v);
    }

    // Process each generation
    for (const [genCode, genVehicles] of genGroups) {
      // Create or get generation
      let { data: generation } = await supabase
        .from('generations')
        .select('id')
        .eq('model_id', model.id)
        .eq('internal_code', genCode)
        .single();

      if (!generation) {
        // Find year range
        const years = genVehicles
          .map(v => v.year_start)
          .filter(y => y && y > 1950 && y < 2030) as number[];
        
        const yearStart = years.length > 0 ? Math.min(...years) : null;
        const yearEnd = years.length > 0 ? Math.max(...years) : null;

        const { data: newGen, error } = await supabase
          .from('generations')
          .insert({
            model_id: model.id,
            name: `${modelName} ${genCode}`,
            slug: slugify(`${brandName}-${modelName}-${genCode}`),
            internal_code: genCode,
            year_start: yearStart,
            year_end: yearEnd,
          })
          .select('id')
          .single();

        if (error) continue;
        generation = newGen;
        generationsCreated++;
      }

      // Create variants
      for (const v of genVehicles) {
        // Check if variant exists
        const { data: existing } = await supabase
          .from('engine_variants')
          .select('id')
          .eq('generation_id', generation.id)
          .eq('name', v.variant)
          .single();

        if (existing) continue;

        // Insert variant
        const { data: variant, error: variantError } = await supabase
          .from('engine_variants')
          .insert({
            generation_id: generation.id,
            name: v.variant,
            engine_code: null,
            fuel_type: v.drivetrain?.toLowerCase().includes('electric') ? 'electric' : 'petrol',
            source_url: v.source_url,
          })
          .select('id')
          .single();

        if (variantError || !variant) continue;
        variantsCreated++;

        // Insert powertrain specs
        await supabase.from('powertrain_specs').insert({
          variant_id: variant.id,
          displacement_cc: v.displacement_cc,
          cylinders: null,
          power_hp: v.power_hp,
          power_kw: v.power_kw,
          torque_nm: v.torque_nm,
          transmission_type: v.transmission,
          gears: null,
          drivetrain: v.drivetrain,
        });

        // Insert performance specs
        await supabase.from('performance_specs').insert({
          variant_id: variant.id,
          acceleration_0_100_kmh: v.acceleration_0_100,
          top_speed_kmh: v.top_speed_kmh,
          fuel_consumption_combined: v.fuel_consumption_l100km,
          co2_emissions: v.co2_gkm,
        });
      }
    }

    process.stdout.write(`\r   Models: ${modelsCreated} | Generations: ${generationsCreated} | Variants: ${variantsCreated}`);
  }

  console.log(`\n   ✅ Done: ${modelsCreated} models, ${generationsCreated} generations, ${variantsCreated} variants`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Import Audi/Porsche/VW                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const dataDir = path.join(__dirname, '../data/ultimatespecs');
  const brands = ['audi', 'porsche', 'volkswagen'];

  for (const brandSlug of brands) {
    const file = path.join(dataDir, `${brandSlug}.json`);
    
    if (!fs.existsSync(file)) {
      console.log(`\n⚠️  File not found: ${file}`);
      continue;
    }

    const vehicles: ScrapedVehicle[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const brandName = brandSlug === 'volkswagen' ? 'Volkswagen' : 
                      brandSlug.charAt(0).toUpperCase() + brandSlug.slice(1);
    
    await importBrand(brandName, vehicles);
  }

  // Final stats
  console.log('\n' + '═'.repeat(60));
  console.log('FINAL DATABASE STATS');
  console.log('═'.repeat(60));

  const { count: brandCount } = await supabase.from('brands').select('*', { count: 'exact', head: true });
  const { count: modelCount } = await supabase.from('models').select('*', { count: 'exact', head: true });
  const { count: genCount } = await supabase.from('generations').select('*', { count: 'exact', head: true });
  const { count: variantCount } = await supabase.from('engine_variants').select('*', { count: 'exact', head: true });

  console.log(`   Brands: ${brandCount}`);
  console.log(`   Models: ${modelCount}`);
  console.log(`   Generations: ${genCount}`);
  console.log(`   Variants: ${variantCount}`);

  console.log('\n✅ Import complete!');
}

main().catch(console.error);
