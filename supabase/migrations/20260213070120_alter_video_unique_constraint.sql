-- Change UNIQUE constraint to allow same video on multiple generations
-- Old: UNIQUE(platform, video_id)
-- New: UNIQUE(generation_id, platform, video_id)

-- Drop old constraint and index
ALTER TABLE vehicle_videos DROP CONSTRAINT IF EXISTS vehicle_videos_platform_video_id_key;
DROP INDEX IF EXISTS idx_vehicle_videos_platform_video_id;

-- Add new constraint
ALTER TABLE vehicle_videos ADD CONSTRAINT vehicle_videos_gen_platform_video_id_key UNIQUE(generation_id, platform, video_id);

-- Recreate index on new constraint
CREATE INDEX IF NOT EXISTS idx_vehicle_videos_gen_platform_video_id ON vehicle_videos(generation_id, platform, video_id);
