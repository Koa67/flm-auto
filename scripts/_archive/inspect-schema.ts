/**
 * FLM AUTO — Inspect DB Schema
 * 
 * Lists all tables and their columns
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gtixhrjeshkaobwxuvox.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aXhocmplc2hrYW9id3h1dm94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNzEyMCwiZXhwIjoyMDg1MDAzMTIwfQ.FpNyOQiUwcPAPCvpid-yQzdYYRKQxbGDYbln01YbRjM'
);

async function main() {
  console.log('🔍 FLM AUTO — DB Schema Inspection\n');

  // Get one row from each table to see structure
  const tables = ['brands', 'models', 'generations', 'variants', 'third_party_specs', 'vehicle_images', 'photos'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`✅ ${table}:`);
      console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
    } else {
      console.log(`⚠️  ${table}: exists but empty`);
    }
  }
}

main().catch(console.error);
