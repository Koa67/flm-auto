/**
 * FLM AUTO - Fix Data Migration
 * 1. Extract internal_code from generation names (e.g., "Mercedes X174" -> internal_code="X174")
 * 2. Clean up model names 
 * 3. Enable dimensions_specs and fuel_specs tables in API
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Common chassis code patterns
const CHASSIS_PATTERNS = {
  BMW: /\b([EFG]\d{2,3})\b/i,  // E30, E46, F80, G20, etc.
  'Mercedes-Benz': /\b([WVRCAXS]\d{2,3}[A-Z]?)\b/i,  // W140, W463, C197, X174, etc.
  Lamborghini: /\b(LP\d{3,4}[S]?)\b/i,  // LP400, LP640, LP700, etc.
};

// Real model names mapping (common patterns from UltimateSpecs)
const MODEL_NAME_FIXES: Record<string, string> = {
  // BMW
  'BMW 1': '1 Series',
  'BMW 2': '2 Series', 
  'BMW 3': '3 Series',
  'BMW 4': '4 Series',
  'BMW 5': '5 Series',
  'BMW 6': '6 Series',
  'BMW 7': '7 Series',
  'BMW 8': '8 Series',
  'BMW i': 'i Series',
  'BMW LCI': 'LCI',
  // Mercedes prefixes to remove
  'Mercedes ': '',
  'Mercedes-Benz ': '',
};

async function extractChassisCode(genName: string, brandName: string): Promise<string | null> {
  const pattern = CHASSIS_PATTERNS[brandName as keyof typeof CHASSIS_PATTERNS];
  if (!pattern) return null;
  
  const match = genName.match(pattern);
  return match ? match[1].toUpperCase() : null;
}

async function fixGenerations() {
  console.log('=== FIXING GENERATIONS ===\n');
  
  // Get all generations with their brand info
  const { data: generations, error } = await supabase
    .from('generations')
    .select(`
      id,
      name,
      internal_code,
      models!inner (
        id,
        name,
        brands!inner (
          id,
          name
        )
      )
    `);
  
  if (error || !generations) {
    console.error('Error fetching generations:', error);
    return;
  }
  
  console.log(`Found ${generations.length} generations to process`);
  
  let updated = 0;
  let errors = 0;
  
  for (const gen of generations) {
    const model = gen.models as any;
    const brand = model?.brands?.name;
    
    if (!brand) continue;
    
    // Extract chassis code from name
    const chassisCode = await extractChassisCode(gen.name, brand);
    
    if (chassisCode && !gen.internal_code) {
      const { error: updateError } = await supabase
        .from('generations')
        .update({ internal_code: chassisCode })
        .eq('id', gen.id);
      
      if (updateError) {
        errors++;
        console.error(`  Error updating ${gen.name}:`, updateError.message);
      } else {
        updated++;
        if (updated <= 20) {
          console.log(`  ✓ ${gen.name} -> internal_code: ${chassisCode}`);
        }
      }
    }
  }
  
  console.log(`\nUpdated ${updated} generations with internal_code`);
  if (errors > 0) console.log(`Errors: ${errors}`);
}

async function fixModelNames() {
  console.log('\n=== FIXING MODEL NAMES ===\n');
  
  // Get all models
  const { data: models, error } = await supabase
    .from('models')
    .select(`
      id,
      name,
      brands!inner (name)
    `);
  
  if (error || !models) {
    console.error('Error fetching models:', error);
    return;
  }
  
  let updated = 0;
  
  for (const model of models) {
    const brand = (model.brands as any)?.name;
    let newName = model.name;
    let changed = false;
    
    // Apply fixes
    for (const [pattern, replacement] of Object.entries(MODEL_NAME_FIXES)) {
      if (newName.includes(pattern)) {
        newName = newName.replace(pattern, replacement).trim();
        changed = true;
      }
    }
    
    // For Mercedes, the generation name often contains the real model
    // E.g., "Mercedes W123" should extract model info differently
    
    if (changed && newName !== model.name && newName.length > 0) {
      const { error: updateError } = await supabase
        .from('models')
        .update({ name: newName })
        .eq('id', model.id);
      
      if (!updateError) {
        updated++;
        console.log(`  ✓ "${model.name}" -> "${newName}"`);
      }
    }
  }
  
  console.log(`\nUpdated ${updated} model names`);
}

async function analyzeData() {
  console.log('\n=== DATA ANALYSIS ===\n');
  
  // Count generations by brand with internal_code
  const { data: stats } = await supabase
    .from('generations')
    .select(`
      internal_code,
      models!inner (
        brands!inner (name)
      )
    `);
  
  if (stats) {
    const byBrand: Record<string, { total: number; withCode: number }> = {};
    
    for (const gen of stats) {
      const brand = (gen.models as any)?.brands?.name || 'Unknown';
      if (!byBrand[brand]) byBrand[brand] = { total: 0, withCode: 0 };
      byBrand[brand].total++;
      if (gen.internal_code) byBrand[brand].withCode++;
    }
    
    console.log('Generations by brand:');
    for (const [brand, counts] of Object.entries(byBrand)) {
      const pct = Math.round((counts.withCode / counts.total) * 100);
      console.log(`  ${brand}: ${counts.withCode}/${counts.total} have internal_code (${pct}%)`);
    }
  }
  
  // Sample of extracted codes
  console.log('\nSample internal_codes after fix:');
  const { data: sample } = await supabase
    .from('generations')
    .select('name, internal_code')
    .not('internal_code', 'is', null)
    .limit(20);
  
  if (sample) {
    for (const g of sample) {
      console.log(`  ${g.internal_code} <- "${g.name}"`);
    }
  }
}

async function verifyIconicVehicles() {
  console.log('\n=== VERIFYING ICONIC VEHICLES ===\n');
  
  const iconics = [
    { brand: 'BMW', code: 'E46', name: 'M3 E46' },
    { brand: 'BMW', code: 'E39', name: 'M5 E39' },
    { brand: 'BMW', code: 'E38', name: '7 Series E38' },
    { brand: 'BMW', code: 'F80', name: 'M3 F80' },
    { brand: 'Mercedes-Benz', code: 'W140', name: 'S-Class W140' },
    { brand: 'Mercedes-Benz', code: 'W126', name: 'S-Class W126' },
    { brand: 'Mercedes-Benz', code: 'W463', name: 'G-Class W463' },
    { brand: 'Mercedes-Benz', code: 'C197', name: 'SLS AMG' },
  ];
  
  for (const iconic of iconics) {
    const { data, error } = await supabase
      .from('generations')
      .select(`
        id,
        name,
        internal_code,
        models!inner (
          name,
          brands!inner (name)
        )
      `)
      .eq('internal_code', iconic.code)
      .limit(1);
    
    if (data && data.length > 0) {
      console.log(`  ✓ ${iconic.name} (${iconic.code}) - FOUND`);
    } else {
      // Try partial match
      const { data: partial } = await supabase
        .from('generations')
        .select('name, internal_code')
        .ilike('internal_code', `%${iconic.code}%`)
        .limit(1);
      
      if (partial && partial.length > 0) {
        console.log(`  ~ ${iconic.name} (${iconic.code}) - Found as: ${partial[0].internal_code}`);
      } else {
        console.log(`  ✗ ${iconic.name} (${iconic.code}) - NOT FOUND`);
      }
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         FLM AUTO - DATA FIX MIGRATION                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Step 1: Fix generations (extract internal_code)
  await fixGenerations();
  
  // Step 2: Fix model names
  await fixModelNames();
  
  // Step 3: Analyze results
  await analyzeData();
  
  // Step 4: Verify iconic vehicles
  await verifyIconicVehicles();
  
  console.log('\n✓ Migration complete!');
  console.log('\nNote: To enable dimensions_specs and fuel_specs tables in Supabase:');
  console.log('1. Go to Supabase Dashboard > Table Editor');
  console.log('2. Find dimensions_specs and fuel_specs tables');
  console.log('3. Enable "Enable Row Level Security" or add to public schema');
}

main().catch(console.error);
