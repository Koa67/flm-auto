-- Phase 4: Vehicle Recalls table
-- FLM AUTO - 2026-02-10

CREATE TABLE IF NOT EXISTS vehicle_recalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vehicle identification
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  generation_id UUID REFERENCES generations(id) ON DELETE SET NULL,

  -- Recall identification
  recall_number TEXT NOT NULL,
  recall_date DATE NOT NULL,
  source TEXT NOT NULL, -- 'nhtsa', 'rapex', 'utac', 'manufacturer'

  -- Issue details
  component TEXT NOT NULL, -- 'airbag', 'brakes', 'fuel_system', 'electrical', 'engine', 'steering', 'transmission', 'suspension', 'tires_wheels', 'seats_belts', 'doors_locks', 'lights', 'software', 'other'
  issue_summary TEXT NOT NULL,
  issue_description TEXT,
  risk_level TEXT DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'

  -- Affected vehicles
  affected_year_start INTEGER,
  affected_year_end INTEGER,
  estimated_affected_units INTEGER,

  -- Resolution
  remedy TEXT,
  remedy_available BOOLEAN DEFAULT true,

  -- Source
  source_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(recall_number, source)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recalls_brand_model ON vehicle_recalls(brand, model);
CREATE INDEX IF NOT EXISTS idx_recalls_generation ON vehicle_recalls(generation_id);
CREATE INDEX IF NOT EXISTS idx_recalls_date ON vehicle_recalls(recall_date DESC);
CREATE INDEX IF NOT EXISTS idx_recalls_component ON vehicle_recalls(component);
CREATE INDEX IF NOT EXISTS idx_recalls_risk ON vehicle_recalls(risk_level);

-- RLS
ALTER TABLE vehicle_recalls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_recalls_public_read" ON vehicle_recalls
  FOR SELECT USING (true);
