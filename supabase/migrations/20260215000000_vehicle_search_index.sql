-- Vehicle search index: denormalized table for fast faceted search
-- Populated by scripts/build-search-index.ts

CREATE TABLE IF NOT EXISTS vehicle_search_index (
  generation_id UUID PRIMARY KEY REFERENCES generations(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  brand_slug TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_slug TEXT NOT NULL,
  segment TEXT,
  generation_name TEXT NOT NULL,
  generation_slug TEXT NOT NULL,
  internal_code TEXT,
  body_style TEXT,
  year_start INT,
  year_end INT,
  fuel_type TEXT,
  power_hp INT,
  acceleration_0_100 NUMERIC(4,1),
  top_speed_kmh INT,
  ncap_stars INT,
  trunk_volume_liters INT,
  isofix_points INT,
  three_across BOOLEAN,
  thumbnail_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_vsi_brand ON vehicle_search_index (brand_slug);
CREATE INDEX IF NOT EXISTS idx_vsi_segment ON vehicle_search_index (segment);
CREATE INDEX IF NOT EXISTS idx_vsi_fuel ON vehicle_search_index (fuel_type);
CREATE INDEX IF NOT EXISTS idx_vsi_power ON vehicle_search_index (power_hp);
CREATE INDEX IF NOT EXISTS idx_vsi_year ON vehicle_search_index (year_start);
CREATE INDEX IF NOT EXISTS idx_vsi_ncap ON vehicle_search_index (ncap_stars);
CREATE INDEX IF NOT EXISTS idx_vsi_trunk ON vehicle_search_index (trunk_volume_liters);
CREATE INDEX IF NOT EXISTS idx_vsi_body ON vehicle_search_index (body_style);

-- Trigram indexes for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_vsi_trgm_brand ON vehicle_search_index USING GIN (brand_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vsi_trgm_model ON vehicle_search_index USING GIN (model_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vsi_trgm_gen ON vehicle_search_index USING GIN (generation_name gin_trgm_ops);

-- RLS: public read
ALTER TABLE vehicle_search_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read vehicle_search_index"
  ON vehicle_search_index FOR SELECT TO anon, authenticated
  USING (true);
