-- Photo hero score: computed quality ranking for image sorting
-- Score based on: confidence tier + image type + width
-- Higher score = better quality, shown first

-- Add hero_score column (stored generated column for efficient sorting)
ALTER TABLE vehicle_images
  ADD COLUMN IF NOT EXISTS hero_score SMALLINT GENERATED ALWAYS AS (
    -- Confidence tier (0-10)
    CASE
      WHEN confidence = 'A' THEN 10
      WHEN confidence = 'B' THEN 8
      WHEN confidence = 'C' THEN 6
      WHEN confidence = 'D' THEN 4
      ELSE 2
    END
    -- Image type priority (0-6)
    + CASE
      WHEN image_type = 'exterior' THEN 6
      WHEN image_type = 'interior' THEN 4
      WHEN image_type = 'blueprint' THEN 3
      WHEN image_type = 'technical' THEN 3
      WHEN image_type = 'cutaway' THEN 3
      WHEN image_type = 'diagram' THEN 2
      ELSE 1
    END
    -- Width bonus (0-5, every 200px = +1)
    + LEAST(COALESCE(width, 0) / 200, 5)
  ) STORED;

-- Index for efficient sorting by hero_score
CREATE INDEX IF NOT EXISTS idx_vehicle_images_hero_score
  ON vehicle_images (generation_id, hero_score DESC);

-- Deduplicate: remove exact URL duplicates within same generation
-- (keeps the row with highest hero_score)
DELETE FROM vehicle_images a
  USING vehicle_images b
  WHERE a.id > b.id
    AND a.generation_id = b.generation_id
    AND a.url = b.url;

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_images_unique_url_gen
  ON vehicle_images (generation_id, url);
