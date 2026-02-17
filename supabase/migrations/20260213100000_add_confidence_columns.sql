-- Add confidence tier columns to data tables
-- A = Verified, B = Propagated close, C = Propagated far, D = Inferred, E = Suspect

ALTER TABLE safety_ratings ADD COLUMN IF NOT EXISTS confidence CHAR(1) DEFAULT NULL;
ALTER TABLE vehicle_videos ADD COLUMN IF NOT EXISTS confidence CHAR(1) DEFAULT NULL;
ALTER TABLE interior_dimensions ADD COLUMN IF NOT EXISTS confidence CHAR(1) DEFAULT NULL;
ALTER TABLE family_fit_compatibility ADD COLUMN IF NOT EXISTS confidence CHAR(1) DEFAULT NULL;
ALTER TABLE vehicle_images ADD COLUMN IF NOT EXISTS confidence CHAR(1) DEFAULT NULL;

-- Indexes for filtering by confidence
CREATE INDEX IF NOT EXISTS idx_safety_ratings_confidence ON safety_ratings(confidence);
CREATE INDEX IF NOT EXISTS idx_vehicle_videos_confidence ON vehicle_videos(confidence);
CREATE INDEX IF NOT EXISTS idx_interior_dimensions_confidence ON interior_dimensions(confidence);
CREATE INDEX IF NOT EXISTS idx_family_fit_confidence ON family_fit_compatibility(confidence);
CREATE INDEX IF NOT EXISTS idx_vehicle_images_confidence ON vehicle_images(confidence);
