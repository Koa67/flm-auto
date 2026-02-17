-- Phase 4: Maintenance Costs table
-- FLM AUTO - 2026-02-10

CREATE TABLE IF NOT EXISTS maintenance_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,

  -- Service type
  service_type TEXT NOT NULL, -- 'oil_change', 'brake_pads_front', 'brake_pads_rear', 'brake_discs', 'timing_belt', 'timing_chain', 'spark_plugs', 'air_filter', 'cabin_filter', 'tires', 'battery', 'major_service', 'minor_service', 'clutch'

  -- Intervals
  interval_km INTEGER,
  interval_months INTEGER,

  -- Cost estimates (EUR)
  estimated_cost_eur_min INTEGER,
  estimated_cost_eur_max INTEGER,
  parts_cost_eur INTEGER,
  labor_hours DECIMAL(4,1),

  -- Notes
  notes TEXT,

  -- Source
  source TEXT,
  source_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(generation_id, service_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_generation ON maintenance_costs(generation_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_type ON maintenance_costs(service_type);

-- RLS
ALTER TABLE maintenance_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maintenance_costs_public_read" ON maintenance_costs
  FOR SELECT USING (true);
