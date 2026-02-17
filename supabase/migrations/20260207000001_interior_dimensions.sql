-- Interior dimensions table for detailed cabin measurements
CREATE TABLE IF NOT EXISTS interior_dimensions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,

  -- Headroom (mm)
  front_headroom_mm INTEGER,
  rear_headroom_mm INTEGER,

  -- Legroom (mm)
  front_legroom_mm INTEGER,
  rear_legroom_mm INTEGER,

  -- Shoulder room (mm)
  front_shoulder_room_mm INTEGER,
  rear_shoulder_room_mm INTEGER,

  -- Hip room (mm)
  front_hip_room_mm INTEGER,
  rear_hip_room_mm INTEGER,

  -- Elbow room (mm)
  front_elbow_room_mm INTEGER,
  rear_elbow_room_mm INTEGER,

  -- Cargo
  cargo_volume_liters INTEGER,
  cargo_volume_max_liters INTEGER, -- with seats folded
  frunk_volume_liters INTEGER,     -- for EVs

  -- Overall interior
  cabin_length_mm INTEGER,
  cabin_width_mm INTEGER,
  cabin_height_mm INTEGER,

  -- Source info
  source TEXT,
  source_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(generation_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_interior_dimensions_gen ON interior_dimensions(generation_id);

-- RLS
ALTER TABLE interior_dimensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interior_dimensions_public_read" ON interior_dimensions
  FOR SELECT USING (true);
