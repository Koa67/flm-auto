-- Vehicle Videos table for YouTube/video content
CREATE TABLE IF NOT EXISTS vehicle_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES generations(id),
  platform VARCHAR(50) DEFAULT 'youtube',
  video_id VARCHAR(100) NOT NULL,
  title TEXT,
  channel_name VARCHAR(255),
  channel_id VARCHAR(100),
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  view_count BIGINT,
  published_at TIMESTAMPTZ,
  video_type VARCHAR(50),
  language VARCHAR(10),
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, video_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_videos_generation_id ON vehicle_videos(generation_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_videos_video_type ON vehicle_videos(video_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_videos_platform_video_id ON vehicle_videos(platform, video_id);

-- Enable RLS
ALTER TABLE vehicle_videos ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "vehicle_videos_public_read" ON vehicle_videos
  FOR SELECT USING (true);
