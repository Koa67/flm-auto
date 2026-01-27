-- Migration: Add safety_ratings table for Euro NCAP data
-- Stores crash test ratings from Euro NCAP for generations

CREATE TABLE IF NOT EXISTS safety_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  
  -- Euro NCAP identifiers
  euroncap_id TEXT,
  source_url TEXT,
  
  -- Star rating (1-5)
  stars INTEGER CHECK (stars >= 1 AND stars <= 5),
  
  -- Category percentages (0-100)
  adult_occupant_pct INTEGER CHECK (adult_occupant_pct >= 0 AND adult_occupant_pct <= 100),
  child_occupant_pct INTEGER CHECK (child_occupant_pct >= 0 AND child_occupant_pct <= 100),
  pedestrian_pct INTEGER CHECK (pedestrian_pct >= 0 AND pedestrian_pct <= 100),
  safety_assist_pct INTEGER CHECK (safety_assist_pct >= 0 AND safety_assist_pct <= 100),
  
  -- Test metadata
  test_year INTEGER,
  test_protocol TEXT, -- e.g., '2023 Protocol'
  
  -- Safety equipment flags (optional, for detailed view)
  has_active_bonnet BOOLEAN DEFAULT false,
  has_aeb_pedestrian BOOLEAN DEFAULT false,
  has_aeb_cyclist BOOLEAN DEFAULT false,
  has_lane_assist BOOLEAN DEFAULT false,
  has_speed_assist BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One rating per generation
  UNIQUE(generation_id)
);

-- Index for lookups
CREATE INDEX idx_safety_ratings_generation ON safety_ratings(generation_id);
CREATE INDEX idx_safety_ratings_stars ON safety_ratings(stars);

-- Comments
COMMENT ON TABLE safety_ratings IS 'Euro NCAP crash test safety ratings by generation';
COMMENT ON COLUMN safety_ratings.stars IS 'Overall Euro NCAP star rating (1-5)';
COMMENT ON COLUMN safety_ratings.adult_occupant_pct IS 'Adult occupant protection score percentage';
COMMENT ON COLUMN safety_ratings.child_occupant_pct IS 'Child occupant protection score percentage';
COMMENT ON COLUMN safety_ratings.pedestrian_pct IS 'Vulnerable road user (pedestrian/cyclist) protection percentage';
COMMENT ON COLUMN safety_ratings.safety_assist_pct IS 'Safety assist features score percentage';
