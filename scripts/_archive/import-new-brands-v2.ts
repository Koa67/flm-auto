/**
 * FLM AUTO - Import new brands v2 (with debug)
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

function extractModelName(variant: string, brand: string): string {
  let name = variant.replace(new RegExp(`^${brand}\\s*`, 'i'), '').trim();
  
  const patterns = [
    /^(A\d|Q\d|RS\s?\d?|S\d|TT|R8|e-tron)/i,
    /^(\d{3}|Cayenne|Panamera|Macan|Taycan|Boxster|Cayman|Carrera)/i,
    /^(Golf|Passat|Polo|Tiguan|Touareg|Arteon|ID\.\d?|Jetta|Beetle|Scirocco|Corrado|Phaeton|Touran|Sharan|Up|T-Roc|T-Cross|Taigo)/i,
  ];
  
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) return match[1].replace(/\s+/g, '');
  }
  
  return name.split(/\s+/)[0] || 'Other';
}

function extractGenCode(variant: string, genField: string | null): string {
  if (genField) {
    const cleaned = genField.replace(/[()]/g, '').replace(/-/g, ' ').trim();
    if (cleaned.length >= 2) return cleaned;
  }
  
  const patterns = [
    /\(([A-Z0-9]{2,})\)/i,
    /\b([A-Z]\d{1,2})\b/,
    /\b(8[A-Z]|PL\d+|1[A-Z]\d?)\b/i, // Audi codes like 8Z, 8P, etc.
  ];
  
  for (const p of patterns) {
    const m = variant.match(p);
    if (m) return m[1];
  }
  
  return 'Gen1';
}

async function importBrand(brandName: string, vehicles: ScrapedVehicle[]) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Importing ${brandName}: ${vehicles.length} vehicles`);
  console.log('─'.repeat(50));

  // Get or create brand
  let { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('name', brandName)
    .single();

  if (!brand) {
    console.log(`   Brand ${brandName} not found, skipping...`);
    return;
  }
  console.log(`   Brand ID: ${brand.id}`);

  // Group by model -> generation -> variants
  const structure = new Map<string, Map<string, ScrapedVehicle[]>>();
  
  for (const v of vehicles) {
    const modelName = extractModelName(v.variant, brandName);
    const genCode = extractGenCode(v.variant, v.generation);
    
    if (!structure.has(modelName)) {
      structure.set(modelName, new Map());
    }
    if (!structure.get(modelName)!.has(genCode)) {
      structure.get(modelName)!.set(genCode, []);
    }
    structure.get(modelName)!.get(genCode)!.push(v);
  }

  console.log(`   Structure: ${structure.size} models`);

  let genCreated = 0;
  let varCreated = 0;

  for (const [modelName, generations] of structure) {
    // Get or create model
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

      if (error) {
        console.log(`   ❌ Model error: ${error.message}`);
        continue;
      }
      model = newModel;
    }

    for (const [genCode, genVehicles] of generations) {
      // Get or create generation
      let { data: generation } = await supabase
        .from('generations')
        .select('id')
        .eq('model_id', model!.id)
        .eq('internal_code', genCode)
        .single();

      if (!generation) {
        const years = genVehicles
          .map(v => v.year_start)
          .filter(y => y && y > 1950 && y < 2030) as number[];

        const { data: newGen, error } = await supabase
          .from('generations')
          .insert({
            model_id: model!.id,
            name: `${modelName} ${genCode}`,
            slug: slugify(`${brandName}-${modelName}-${genCode}`),
            internal_code: genCode,
          })
          .select('id')
          .single();

        if (error) {
          console.log(`   ❌ Gen error (${modelName} ${genCode}): ${error.message}`);
          continue;
        }
        generation = newGen;
        genCreated++;
      }

      // Insert variants
      for (const v of genVehicles) {
        // Check duplicate
        const { data: existing } = await supabase
          .from('engine_variants')
          .select('id')
          .eq('generation_id', generation!.id)
          .eq('name', v.variant)
          .maybeSingle();

        if (existing) continue;

        // Insert variant
        const { data: variant, error: varErr } = await supabase
          .from('engine_variants')
          .insert({
            generation_id: generation!.id,
            name: v.variant,
            slug: slugify(v.variant),
            fuel_type: v.drivetrain?.toLowerCase().includes('electric') ? 'electric' : 'petrol',
          })
          .select('id')
          .single();

        if (varErr) {
          if (varCreated === 0) console.log(`\n   ❌ Variant error: ${varErr.message}`);
          continue;
        }
        if (!variant) continue;
        varCreated++;

        // Powertrain
        await supabase.from('powertrain_specs').insert({
          variant_id: variant.id,
          displacement_cc: v.displacement_cc,
          power_hp: v.power_hp,
          power_kw: v.power_kw,
          torque_nm: v.torque_nm,
          transmission_type: v.transmission,
          drivetrain: v.drivetrain,
        });

        // Performance
        await supabase.from('performance_specs').insert({
          variant_id: variant.id,
          acceleration_0_100_kmh: v.acceleration_0_100,
          top_speed_kmh: v.top_speed_kmh,
          fuel_consumption_combined: v.fuel_consumption_l100km,
          co2_emissions: v.co2_gkm,
        });
      }

      process.stdout.write(`\r   Progress: ${genCreated} generations, ${varCreated} variants`);
    }
  }

  console.log(`\n   ✅ Created: ${genCreated} generations, ${varCreated} variants`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     FLM AUTO - Import Audi/Porsche/VW v2                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const dataDir = path.join(__dirname, '../data/ultimatespecs');

  for (const brandSlug of ['audi', 'porsche', 'volkswagen']) {
    const file = path.join(dataDir, `${brandSlug}.json`);
    if (!fs.existsSync(file)) continue;

    const vehicles: ScrapedVehicle[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const brandName = brandSlug.charAt(0).toUpperCase() + brandSlug.slice(1);
    
    await importBrand(brandName, vehicles);
  }

  // Stats
  console.log('\n' + '═'.repeat(60));
  const { count: brands } = await supabase.from('brands').select('*', { count: 'exact', head: true });
  const { count: models } = await supabase.from('models').select('*', { count: 'exact', head: true });
  const { count: gens } = await supabase.from('generations').select('*', { count: 'exact', head: true });
  const { count: vars } = await supabase.from('engine_variants').select('*', { count: 'exact', head: true });

  console.log(`Brands: ${brands} | Models: ${models} | Generations: ${gens} | Variants: ${vars}`);
  console.log('\n✅ Done!');
}

main().catch(console.error);
