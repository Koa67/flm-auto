-- Phase 3: EuroNCAP + Pricing + Family Fit tables

-- 1. Vehicle pricing table
CREATE TABLE IF NOT EXISTS vehicle_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES generations(id),
  engine_variant_id UUID REFERENCES engine_variants(id),
  price_new_eur INTEGER,
  price_new_source VARCHAR(50),
  malus_2024_eur INTEGER,
  malus_2025_eur INTEGER,
  co2_gkm INTEGER,
  raw_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(generation_id, engine_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_pricing_gen ON vehicle_pricing(generation_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_pricing_malus ON vehicle_pricing(malus_2024_eur) WHERE malus_2024_eur IS NOT NULL;

-- 2. Extend child_seats with missing columns
ALTER TABLE child_seats ADD COLUMN IF NOT EXISTS seat_type VARCHAR(50);
ALTER TABLE child_seats ADD COLUMN IF NOT EXISTS group_ece VARCHAR(20);
ALTER TABLE child_seats ADD COLUMN IF NOT EXISTS weight_min_kg DECIMAL(4,1);
ALTER TABLE child_seats ADD COLUMN IF NOT EXISTS weight_max_kg DECIMAL(4,1);
ALTER TABLE child_seats ADD COLUMN IF NOT EXISTS age_min_months INTEGER;
ALTER TABLE child_seats ADD COLUMN IF NOT EXISTS age_max_months INTEGER;
ALTER TABLE child_seats ADD COLUMN IF NOT EXISTS isofix_compatible BOOLEAN DEFAULT false;
ALTER TABLE child_seats ADD COLUMN IF NOT EXISTS belt_compatible BOOLEAN DEFAULT true;
ALTER TABLE child_seats ADD COLUMN IF NOT EXISTS swivel BOOLEAN DEFAULT false;
ALTER TABLE child_seats ADD COLUMN IF NOT EXISTS price_eur INTEGER;
ALTER TABLE child_seats ADD COLUMN IF NOT EXISTS product_url TEXT;

-- 3. Child seat vehicle compatibility table
CREATE TABLE IF NOT EXISTS child_seat_vehicle_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_seat_id UUID REFERENCES child_seats(id),
  generation_id UUID REFERENCES generations(id),
  position VARCHAR(20) NOT NULL,
  compatible BOOLEAN NOT NULL,
  fit_rating VARCHAR(20),
  notes TEXT,
  source VARCHAR(100),
  verified BOOLEAN DEFAULT false,
  UNIQUE(child_seat_id, generation_id, position)
);

CREATE INDEX IF NOT EXISTS idx_csv_gen ON child_seat_vehicle_compatibility(generation_id);
CREATE INDEX IF NOT EXISTS idx_csv_seat ON child_seat_vehicle_compatibility(child_seat_id);

-- 4. Add family_fit_score to family_fit_compatibility if not exists
ALTER TABLE family_fit_compatibility ADD COLUMN IF NOT EXISTS family_fit_score INTEGER;
