-- Phase 4: Image subcategories + extended interior dimensions
-- FLM AUTO - 2026-02-10

-- ============================================================================
-- IMAGE SUBCATEGORIES
-- ============================================================================

-- Add subcategory for granular image classification
ALTER TABLE vehicle_images
ADD COLUMN IF NOT EXISTS image_subcategory TEXT;

-- Index for searching by subcategory within a generation
CREATE INDEX IF NOT EXISTS idx_vehicle_images_subcategory
ON vehicle_images(generation_id, image_subcategory)
WHERE image_subcategory IS NOT NULL;

-- ============================================================================
-- EXTENDED INTERIOR DIMENSIONS
-- ============================================================================

-- Trunk detailed measurements
ALTER TABLE interior_dimensions
ADD COLUMN IF NOT EXISTS trunk_loading_height_mm INTEGER,
ADD COLUMN IF NOT EXISTS trunk_loading_width_mm INTEGER,
ADD COLUMN IF NOT EXISTS trunk_length_mm INTEGER,
ADD COLUMN IF NOT EXISTS trunk_width_mm INTEGER,
ADD COLUMN IF NOT EXISTS trunk_width_wheelhouses_mm INTEGER,
ADD COLUMN IF NOT EXISTS trunk_height_mm INTEGER;

-- Rear bench detailed measurements
ALTER TABLE interior_dimensions
ADD COLUMN IF NOT EXISTS rear_bench_width_total_mm INTEGER,
ADD COLUMN IF NOT EXISTS rear_bench_width_left_mm INTEGER,
ADD COLUMN IF NOT EXISTS rear_bench_width_center_mm INTEGER,
ADD COLUMN IF NOT EXISTS rear_bench_width_right_mm INTEGER;

-- Door & access ergonomics
ALTER TABLE interior_dimensions
ADD COLUMN IF NOT EXISTS door_opening_angle_front INTEGER,
ADD COLUMN IF NOT EXISTS door_opening_angle_rear INTEGER,
ADD COLUMN IF NOT EXISTS step_in_height_front_mm INTEGER,
ADD COLUMN IF NOT EXISTS step_in_height_rear_mm INTEGER;

-- ISOFIX schema reference
ALTER TABLE interior_dimensions
ADD COLUMN IF NOT EXISTS isofix_schema_url TEXT;

-- Index for loading height (key for senior/accessibility searches)
CREATE INDEX IF NOT EXISTS idx_interior_loading_height
ON interior_dimensions(trunk_loading_height_mm)
WHERE trunk_loading_height_mm IS NOT NULL;
