CREATE TABLE IF NOT EXISTS third_party_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_url TEXT,
  spec_type TEXT NOT NULL,
  spec_value NUMERIC,
  raw_data JSONB,
  tested_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(generation_id, source, spec_type)
);

CREATE INDEX IF NOT EXISTS idx_third_party_specs_generation ON third_party_specs(generation_id);
CREATE INDEX IF NOT EXISTS idx_third_party_specs_source ON third_party_specs(source);

COMMENT ON TABLE third_party_specs IS 'Third-party tested specifications (ADAC, Euro NCAP, etc.)';
