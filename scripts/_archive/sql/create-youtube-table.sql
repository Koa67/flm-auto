-- YouTube Videos Table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS youtube_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  channel_id TEXT,
  channel_title TEXT,
  published_at TIMESTAMPTZ,
  description TEXT,
  thumbnail_url TEXT,
  view_count INTEGER,
  like_count INTEGER,
  duration TEXT,
  url TEXT GENERATED ALWAYS AS ('https://www.youtube.com/watch?v=' || video_id) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(generation_id, video_id)
);

CREATE INDEX idx_yt_generation ON youtube_videos(generation_id);
CREATE INDEX idx_yt_video ON youtube_videos(video_id);
CREATE INDEX idx_yt_views ON youtube_videos(view_count DESC);
