-- Migration: Family Fit Compatibility Table
-- FLM AUTO - Phase 2 Family Fit Module
-- Created: 2026-01-31

-- =============================================================================
-- FAMILY FIT COMPATIBILITY TABLE
-- Stores child seat compatibility data for vehicles
-- =============================================================================

CREATE TABLE IF NOT EXISTS family_fit_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  
  -- ISOFIX Equipment
  isofix_points INTEGER DEFAULT 2,                    -- Total ISOFIX points (0, 2, 3, 4, 5, 6)
  isofix_positions TEXT[] DEFAULT ARRAY['left', 'right'],  -- Positions: left, center, right, third_left, etc.
  center_isofix BOOLEAN DEFAULT FALSE,               -- Center rear seat has ISOFIX
  top_tether_points INTEGER DEFAULT 3,               -- Top tether anchor points
  latch_system BOOLEAN DEFAULT FALSE,                -- US LATCH system (vs EU ISOFIX)
  
  -- Rear Bench Dimensions (mm)
  rear_bench_width_total_mm INTEGER,                 -- Total bench width
  rear_bench_width_usable_mm INTEGER,                -- Usable width between belt buckles
  rear_bench_depth_mm INTEGER,                       -- Seat cushion depth
  rear_bench_angle_deg DECIMAL(4,1),                 -- Seat back angle
  
  -- Clearances (mm)
  rear_headroom_mm INTEGER,                          -- Height under roof
  rear_legroom_min_mm INTEGER,                       -- With front seat fully back
  rear_legroom_max_mm INTEGER,                       -- With front seat fully forward
  front_seat_back_clearance_mm INTEGER,              -- Distance to front seat back
  
  -- Access (mm)
  rear_door_opening_width_mm INTEGER,                -- Door opening width
  rear_door_opening_height_mm INTEGER,               -- Door opening height
  door_sill_height_mm INTEGER,                       -- Step-in height
  
  -- Specifics
  center_tunnel_height_mm INTEGER DEFAULT 0,         -- Transmission tunnel height (0 if flat)
  center_tunnel_width_mm INTEGER,                    -- Tunnel width
  fold_flat_front_seat BOOLEAN DEFAULT FALSE,        -- Front passenger folds flat
  sliding_rear_bench BOOLEAN DEFAULT FALSE,          -- Rear bench slides
  
  -- Compatibility Scores (excellent, good, tight, not_recommended, incompatible)
  infant_seat_fit TEXT,                              -- Rear-facing infant seat
  toddler_seat_fit TEXT,                             -- Forward-facing toddler seat
  booster_seat_fit TEXT,                             -- Booster seat for older kids
  
  -- Three-Across Assessment
  three_across_possible BOOLEAN,                     -- Can fit 3 child seats across
  three_across_fit_score TEXT,                       -- excellent, good, tight, not_recommended
  three_across_notes TEXT,                           -- Detailed notes on 3-across fit
  
  -- User Notes
  compatibility_notes TEXT,                          -- General notes
  tested_configurations JSONB,                       -- Specific seat combos tested
  
  -- Source & Verification
  source TEXT NOT NULL DEFAULT 'scraped',            -- measured, adac, tcs, manufacturer, user, scraped
  source_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verified_by TEXT,
  measurement_date DATE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(generation_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_family_fit_generation ON family_fit_compatibility(generation_id);
CREATE INDEX IF NOT EXISTS idx_family_fit_three_across ON family_fit_compatibility(three_across_possible);
CREATE INDEX IF NOT EXISTS idx_family_fit_isofix ON family_fit_compatibility(isofix_points);
CREATE INDEX IF NOT EXISTS idx_family_fit_center_isofix ON family_fit_compatibility(center_isofix);
CREATE INDEX IF NOT EXISTS idx_family_fit_source ON family_fit_compatibility(source);

-- Comments
COMMENT ON TABLE family_fit_compatibility IS 'Child seat compatibility data for Family Fit module';
COMMENT ON COLUMN family_fit_compatibility.isofix_positions IS 'Array of ISOFIX positions: left, center, right, front_passenger, third_left, third_center, third_right';
COMMENT ON COLUMN family_fit_compatibility.three_across_fit_score IS 'Score: excellent (1450mm+), good (1380mm+), tight (1320mm+), not_recommended (<1320mm)';

-- =============================================================================
-- CHILD SEATS DATABASE (Future - P2)
-- =============================================================================

CREATE TABLE IF NOT EXISTS child_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  slug TEXT NOT NULL,
  
  -- Classification
  seat_group TEXT NOT NULL,                          -- 0, 0+, 1, 2, 3, 0+/1, 1/2/3
  seat_type TEXT NOT NULL,                           -- infant, toddler, booster, convertible
  
  -- Dimensions (mm)
  width_base_mm INTEGER,                             -- Width at base
  width_shoulders_mm INTEGER,                        -- Width at shoulders
  depth_mm INTEGER,                                  -- Total depth
  height_mm INTEGER,                                 -- Total height
  
  -- Installation
  installation_type TEXT NOT NULL,                   -- isofix, belt, both
  isofix_leg BOOLEAN DEFAULT FALSE,                  -- Has support leg
  top_tether TEXT DEFAULT 'optional',                -- required, optional, none
  
  -- Weight & Limits
  weight_kg DECIMAL(4,1),                            -- Seat weight
  max_child_weight_kg DECIMAL(4,1),                  -- Max child weight
  max_child_height_cm INTEGER,                       -- Max child height
  min_child_height_cm INTEGER,                       -- Min child height
  
  -- Certifications
  certification TEXT,                                -- ECE_R44, i_Size, both
  adac_rating TEXT,                                  -- ADAC test rating if available
  adac_test_date DATE,
  
  -- Pricing
  price_eur DECIMAL(8,2),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand, model)
);

CREATE INDEX IF NOT EXISTS idx_child_seats_type ON child_seats(seat_type);
CREATE INDEX IF NOT EXISTS idx_child_seats_group ON child_seats(seat_group);
CREATE INDEX IF NOT EXISTS idx_child_seats_brand ON child_seats(brand);

COMMENT ON TABLE child_seats IS 'Child seat database for compatibility matching (Phase 2)';

-- =============================================================================
-- USER FAMILY REPORTS (Crowdsourcing - P2)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_family_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,                                      -- Supabase Auth ID (null if anonymous)
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  
  -- Tested Configuration
  child_seat_id UUID REFERENCES child_seats(id),
  seat_brand TEXT,                                   -- If seat not in DB
  seat_model TEXT,
  position TEXT NOT NULL,                            -- left, center, right
  
  -- Evaluation (1-5 stars)
  installation_ease INTEGER CHECK (installation_ease BETWEEN 1 AND 5),
  fit_quality INTEGER CHECK (fit_quality BETWEEN 1 AND 5),
  child_comfort INTEGER CHECK (child_comfort BETWEEN 1 AND 5),
  access_ease INTEGER CHECK (access_ease BETWEEN 1 AND 5),
  
  -- Details
  issues TEXT[],                                     -- Array of reported issues
  tips TEXT,                                         -- User tips
  photo_urls TEXT[],                                 -- User photos
  
  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verified_by TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, generation_id, position)
);

CREATE INDEX IF NOT EXISTS idx_user_reports_generation ON user_family_reports(generation_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_verified ON user_family_reports(verified);

COMMENT ON TABLE user_family_reports IS 'Crowdsourced child seat fit reports from users';

-- =============================================================================
-- HELPER FUNCTION: Calculate Family Fit Score
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_family_fit_score(
  p_rear_hip_room_mm INTEGER,
  p_rear_headroom_mm INTEGER,
  p_isofix_points INTEGER,
  p_center_isofix BOOLEAN
)
RETURNS TEXT AS $$
DECLARE
  v_score INTEGER := 100;
BEGIN
  -- Hip room scoring (for 3-across)
  IF p_rear_hip_room_mm >= 1450 THEN
    v_score := v_score;
  ELSIF p_rear_hip_room_mm >= 1380 THEN
    v_score := v_score - 10;
  ELSIF p_rear_hip_room_mm >= 1320 THEN
    v_score := v_score - 25;
  ELSE
    v_score := v_score - 40;
  END IF;
  
  -- Headroom scoring
  IF p_rear_headroom_mm >= 980 THEN
    v_score := v_score;
  ELSIF p_rear_headroom_mm >= 950 THEN
    v_score := v_score - 5;
  ELSIF p_rear_headroom_mm >= 920 THEN
    v_score := v_score - 15;
  ELSE
    v_score := v_score - 25;
  END IF;
  
  -- ISOFIX bonus
  IF p_isofix_points >= 3 THEN
    v_score := v_score + 10;
  END IF;
  
  IF p_center_isofix THEN
    v_score := v_score + 5;
  END IF;
  
  -- Return score category
  IF v_score >= 90 THEN
    RETURN 'excellent';
  ELSIF v_score >= 75 THEN
    RETURN 'good';
  ELSIF v_score >= 60 THEN
    RETURN 'tight';
  ELSE
    RETURN 'not_recommended';
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_family_fit_score IS 'Calculates family fit score based on dimensions and ISOFIX';

-- =============================================================================
-- VIEW: Family Fit Overview
-- =============================================================================

CREATE OR REPLACE VIEW v_family_fit_overview AS
SELECT 
  g.id as generation_id,
  b.name as brand,
  m.name as model,
  g.name as generation,
  ff.isofix_points,
  ff.center_isofix,
  ff.rear_headroom_mm,
  ff.rear_legroom_max_mm as rear_legroom_mm,
  ff.rear_bench_width_usable_mm,
  ff.three_across_possible,
  ff.three_across_fit_score,
  ff.infant_seat_fit,
  ff.toddler_seat_fit,
  ff.booster_seat_fit,
  ff.source,
  ff.verified
FROM family_fit_compatibility ff
JOIN generations g ON ff.generation_id = g.id
JOIN models m ON g.model_id = m.id
JOIN brands b ON m.brand_id = b.id
ORDER BY b.name, m.name, g.production_start DESC;

COMMENT ON VIEW v_family_fit_overview IS 'Overview of family fit compatibility data';
