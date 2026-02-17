-- 3D models table (Sketchfab embeds)
CREATE TABLE IF NOT EXISTS vehicle_3d_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT,
  source TEXT NOT NULL,
  model_url TEXT NOT NULL UNIQUE,
  embed_url TEXT,
  thumbnail_url TEXT,
  format TEXT NOT NULL DEFAULT 'embed',
  license TEXT,
  author TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_3d_models_generation ON vehicle_3d_models(generation_id);
CREATE INDEX IF NOT EXISTS idx_3d_models_brand ON vehicle_3d_models(brand);

ALTER TABLE vehicle_3d_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read 3d_models"
ON vehicle_3d_models FOR SELECT
USING (true);
