/**
 * FLM AUTO - Import Detailed Specs (fixed v2)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Extract model name from variant string
function extractModel(variant: string): string | null {
  // "Mercedes Benz Sprinter 2014 L2H1 Van..." -> "Sprinter"
  // "BMW 3 Series G20 320d..." -> "3 Series"
  
  const patterns = [
    /(?:Mercedes[- ]?Benz|BMW|Audi|Volkswagen|VW|Porsche|Skoda|Tesla|Hyundai|Volvo|Toyota|Honda|Ford)\s+(.+?)\s+\d{4}/i,
    /(?:Mercedes[- ]?Benz|BMW|Audi|Volkswagen|VW|Porsche|Skoda|Tesla|Hyundai|Volvo|Toyota|Honda|Ford)\s+(.+?)(?:\s+Specs|\s+\d)/i,
  ];
  
  for (const pattern of patterns) {
    const match = variant.match(pattern);
    if (match) {
      // Clean up: "Sprinter 2014 L2H1 Van 514" -> "Sprinter"
      let model = match[1].trim();
      // Take first word or two
      const parts = model.split(/\s+/);
      if (parts[0].match(/^\d+$/)) {
        // "3 Series" case
        model = parts.slice(0, 2).join(' ');
      } else {
        model = parts[0];
      }
      return model;
    }
  }
  return null;
}

async function main() {
  console.log('📐 FLM AUTO - Import Detailed Specs v2\n');
  
  const file = '../data/detailed-specs.json';
  if (!fs.existsSync(file)) {
    console.log('   ❌ File not found');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const specs = Array.isArray(data) ? data : [];
  
  console.log(`   📊 Found ${specs.length} spec entries\n`);
  
  // Get DB maps
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map<string, string>();
  brands?.forEach(b => {
    brandMap.set(b.name.toLowerCase(), b.id);
    brandMap.set(b.name.toLowerCase().replace(/-/g, ''), b.id);
    brandMap.set(b.name.toLowerCase().replace(/ /g, ''), b.id);
  });
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: generations } = await supabase.from('generations').select('id, model_id, name');
  
  let inserted = 0;
  let matched = 0;
  
  for (const spec of specs) {
    if (!spec.brand) continue;
    
    const brandId = brandMap.get(spec.brand.toLowerCase().replace(/-/g, '').replace(/ /g, ''));
    if (!brandId) continue;
    
    // Extract model from variant
    const modelName = extractModel(spec.variant || '');
    if (!modelName) continue;
    
    // Find matching model in DB
    const brandModels = models?.filter(m => m.brand_id === brandId) || [];
    let genId: string | null = null;
    
    const modelLower = modelName.toLowerCase();
    for (const model of brandModels) {
      const dbName = model.name.toLowerCase();
      if (modelLower === dbName || modelLower.includes(dbName) || dbName.includes(modelLower)) {
        const gens = generations?.filter(g => g.model_id === model.id) || [];
        if (gens.length > 0) {
          genId = gens[0].id;
          matched++;
          break;
        }
      }
    }
    
    if (!genId) continue;
    
    // Convert dimensions (they appear to be in cm, convert to mm)
    const lengthMm = spec.length_mm && spec.length_mm < 100 ? Math.round(spec.length_mm * 100) : spec.length_mm;
    const widthMm = spec.width_mm && spec.width_mm < 100 ? Math.round(spec.width_mm * 100) : spec.width_mm;
    const heightMm = spec.height_mm && spec.height_mm < 100 ? Math.round(spec.height_mm * 100) : spec.height_mm;
    const wheelbaseMm = spec.wheelbase_mm && spec.wheelbase_mm < 100 ? Math.round(spec.wheelbase_mm * 100) : spec.wheelbase_mm;
    
    // Insert combined spec record
    const { error } = await supabase.from('third_party_specs').upsert({
      generation_id: genId,
      source: 'UltimateSpecs',
      source_url: spec.source_url || '',
      spec_type: 'detailed_dimensions',
      spec_value: lengthMm || 0,
      raw_data: {
        variant: spec.variant,
        length_mm: lengthMm,
        width_mm: widthMm,
        height_mm: heightMm,
        wheelbase_mm: wheelbaseMm,
        curb_weight_kg: spec.curb_weight_kg,
        trunk_volume_l: spec.trunk_volume_l,
        fuel_tank_l: spec.fuel_tank_l,
        power_hp: spec.power_hp,
        torque_nm: spec.torque_nm,
        displacement_cc: spec.displacement_cc,
        transmission: spec.transmission,
        drivetrain: spec.drivetrain,
        acceleration_0_100: spec.acceleration_0_100,
        top_speed_kmh: spec.top_speed_kmh,
      },
    }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  // Final stats
  const { count: totalCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  console.log('═'.repeat(50));
  console.log(`   Models matched: ${matched}`);
  console.log(`   Specs inserted: ${inserted}`);
  console.log(`   Total third_party_specs: ${totalCount}`);
}

main().catch(console.error);
