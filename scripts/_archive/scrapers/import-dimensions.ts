/**
 * Import scraped dimensions into Supabase
 * 
 * Run: npx tsx scripts/scrapers/import-dimensions.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

interface ScrapedVehicle {
  brand: string;
  model: string;
  year: string;
  variant?: string;
  body_type: string;
  source: string;
  source_url?: string;
  interior: {
    front_headroom_mm?: number;
    rear_headroom_mm?: number;
    third_row_headroom_mm?: number;
    front_legroom_mm?: number;
    rear_legroom_mm?: number;
    front_shoulder_room_mm?: number;
    rear_shoulder_room_mm?: number;
    front_hip_room_mm?: number;
    rear_hip_room_mm?: number;
    front_width_mm?: number;
    rear_width_mm?: number;
    third_row_width_mm?: number;
    notes?: string;
  };
  exterior: {
    length_mm?: number;
    width_mm?: number;
    height_mm?: number;
    wheelbase_mm?: number;
    ground_clearance_mm?: number;
  };
  cargo: {
    volume_l?: number;
    volume_max_l?: number;
    volume_7_seater_l?: number;
  };
}

interface ScrapedData {
  metadata: {
    scraped_at: string;
    sources: string[];
    version: string;
    total_vehicles: number;
  };
  vehicles: ScrapedVehicle[];
}

async function importDimensions() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  // Load scraped data
  const dataPath = path.join(__dirname, '../../data/interior-dimensions/scraped-dimensions-v1.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const data: ScrapedData = JSON.parse(rawData);
  
  console.log(`📊 Importing ${data.vehicles.length} vehicles...`);
  console.log(`📅 Scraped at: ${data.metadata.scraped_at}`);
  
  let imported = 0;
  let errors = 0;
  
  for (const vehicle of data.vehicles) {
    try {
      // Find or create brand
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('id')
        .ilike('name', vehicle.brand)
        .single();
      
      if (brandError || !brandData) {
        console.log(`⚠️ Brand not found: ${vehicle.brand}, creating...`);
        const { data: newBrand, error: createError } = await supabase
          .from('brands')
          .insert({ name: vehicle.brand, slug: vehicle.brand.toLowerCase() })
          .select('id')
          .single();
        
        if (createError) {
          console.error(`❌ Failed to create brand: ${vehicle.brand}`, createError);
          errors++;
          continue;
        }
      }
      
      // Insert into vehicle_specs_scraped table
      const specRecord = {
        brand: vehicle.brand,
        model: vehicle.model,
        year: parseInt(vehicle.year),
        variant: vehicle.variant,
        body_type: vehicle.body_type,
        source: vehicle.source,
        source_url: vehicle.source_url,
        
        // Interior dimensions
        front_headroom_mm: vehicle.interior.front_headroom_mm,
        rear_headroom_mm: vehicle.interior.rear_headroom_mm,
        third_row_headroom_mm: vehicle.interior.third_row_headroom_mm,
        front_legroom_mm: vehicle.interior.front_legroom_mm,
        rear_legroom_mm: vehicle.interior.rear_legroom_mm,
        front_shoulder_room_mm: vehicle.interior.front_shoulder_room_mm,
        rear_shoulder_room_mm: vehicle.interior.rear_shoulder_room_mm,
        front_hip_room_mm: vehicle.interior.front_hip_room_mm,
        rear_hip_room_mm: vehicle.interior.rear_hip_room_mm,
        
        // Exterior dimensions
        length_mm: vehicle.exterior.length_mm,
        width_mm: vehicle.exterior.width_mm,
        height_mm: vehicle.exterior.height_mm,
        wheelbase_mm: vehicle.exterior.wheelbase_mm,
        ground_clearance_mm: vehicle.exterior.ground_clearance_mm,
        
        // Cargo
        cargo_volume_l: vehicle.cargo.volume_l,
        cargo_volume_max_l: vehicle.cargo.volume_max_l,
        
        // Metadata
        scraped_at: data.metadata.scraped_at,
        data_version: data.metadata.version
      };
      
      const { error: insertError } = await supabase
        .from('vehicle_specs_scraped')
        .upsert(specRecord, {
          onConflict: 'brand,model,year,variant'
        });
      
      if (insertError) {
        console.error(`❌ Failed to insert: ${vehicle.brand} ${vehicle.model}`, insertError);
        errors++;
      } else {
        console.log(`✅ Imported: ${vehicle.brand} ${vehicle.model} ${vehicle.year}`);
        imported++;
      }
      
    } catch (err) {
      console.error(`❌ Error processing: ${vehicle.brand} ${vehicle.model}`, err);
      errors++;
    }
  }
  
  console.log(`\n📊 Import complete: ${imported} success, ${errors} errors`);
}

// Migration SQL to create the table
const MIGRATION_SQL = `
-- Table for scraped vehicle specifications
CREATE TABLE IF NOT EXISTS vehicle_specs_scraped (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Vehicle identification
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  variant TEXT,
  body_type TEXT,
  
  -- Source tracking
  source TEXT NOT NULL,
  source_url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  data_version TEXT,
  
  -- Interior dimensions (mm)
  front_headroom_mm INTEGER,
  rear_headroom_mm INTEGER,
  third_row_headroom_mm INTEGER,
  front_legroom_mm INTEGER,
  rear_legroom_mm INTEGER,
  front_shoulder_room_mm INTEGER,
  rear_shoulder_room_mm INTEGER,
  front_hip_room_mm INTEGER,
  rear_hip_room_mm INTEGER,
  
  -- Exterior dimensions (mm)
  length_mm INTEGER,
  width_mm INTEGER,
  height_mm INTEGER,
  wheelbase_mm INTEGER,
  ground_clearance_mm INTEGER,
  
  -- Cargo (liters)
  cargo_volume_l INTEGER,
  cargo_volume_max_l INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for upserts
  UNIQUE(brand, model, year, variant)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_specs_brand_model ON vehicle_specs_scraped(brand, model);
CREATE INDEX IF NOT EXISTS idx_specs_year ON vehicle_specs_scraped(year);
CREATE INDEX IF NOT EXISTS idx_specs_body_type ON vehicle_specs_scraped(body_type);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_specs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS specs_updated_at ON vehicle_specs_scraped;
CREATE TRIGGER specs_updated_at
  BEFORE UPDATE ON vehicle_specs_scraped
  FOR EACH ROW
  EXECUTE FUNCTION update_specs_timestamp();
`;

// Export migration SQL
export { MIGRATION_SQL };

// Run if called directly
if (require.main === module) {
  console.log('🚀 Starting dimension import...\n');
  console.log('📋 Run this SQL first to create the table:\n');
  console.log(MIGRATION_SQL);
  console.log('\n---\n');
  
  importDimensions().catch(console.error);
}
