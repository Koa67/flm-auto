-- generation_data_quality view
-- Aggregates confidence tiers per generation for front-end badges
-- Usage: SELECT * FROM generation_data_quality WHERE generation_id = 'uuid'

CREATE OR REPLACE VIEW generation_data_quality AS
SELECT
  g.id AS generation_id,
  -- Safety
  sr.confidence AS safety_confidence,
  sr.stars AS safety_stars,
  sr.source_url AS safety_source,
  CASE
    WHEN sr.confidence = 'A' THEN 'verified'
    WHEN sr.confidence = 'B' THEN 'propagated'
    WHEN sr.confidence = 'C' THEN 'estimated'
    WHEN sr.confidence = 'D' THEN 'inferred'
    WHEN sr.confidence = 'E' THEN 'suspect'
    ELSE 'missing'
  END AS safety_label,
  -- Dimensions
  id_conf.confidence AS dims_confidence,
  CASE
    WHEN id_conf.confidence = 'A' THEN 'verified'
    WHEN id_conf.confidence = 'B' THEN 'partial'
    WHEN id_conf.confidence = 'C' THEN 'minimal'
    WHEN id_conf.confidence = 'D' THEN 'estimated'
    WHEN id_conf.confidence = 'E' THEN 'suspect'
    ELSE 'missing'
  END AS dims_label,
  -- Family fit
  ff.confidence AS family_confidence,
  ff.source AS family_source,
  CASE
    WHEN ff.confidence = 'A' THEN 'verified'
    WHEN ff.confidence = 'B' THEN 'calculated'
    WHEN ff.confidence = 'C' THEN 'estimated'
    WHEN ff.confidence = 'D' THEN 'inferred'
    WHEN ff.confidence = 'E' THEN 'suspect'
    ELSE 'missing'
  END AS family_label,
  -- Photos (best confidence across all photos for this gen)
  photo_stats.best_photo_confidence,
  photo_stats.photo_count,
  -- Videos (best confidence across all videos for this gen)
  video_stats.best_video_confidence,
  video_stats.video_count,
  -- Overall quality tier
  CASE
    WHEN sr.confidence IN ('A','B')
     AND id_conf.confidence IN ('A','B')
     AND ff.confidence IN ('A','B')
    THEN 'gold'
    WHEN sr.confidence IN ('A','B','C')
     AND id_conf.confidence IN ('A','B','C')
     AND ff.confidence IN ('A','B','C')
    THEN 'silver'
    WHEN sr.confidence IS NOT NULL
     AND id_conf.confidence IS NOT NULL
    THEN 'bronze'
    ELSE 'incomplete'
  END AS overall_tier
FROM generations g
LEFT JOIN safety_ratings sr ON sr.generation_id = g.id
LEFT JOIN interior_dimensions id_conf ON id_conf.generation_id = g.id
LEFT JOIN family_fit_compatibility ff ON ff.generation_id = g.id
LEFT JOIN LATERAL (
  SELECT
    MIN(vi.confidence) AS best_photo_confidence,
    COUNT(*)::int AS photo_count
  FROM vehicle_images vi
  WHERE vi.generation_id = g.id
) photo_stats ON true
LEFT JOIN LATERAL (
  SELECT
    MIN(vv.confidence) AS best_video_confidence,
    COUNT(*)::int AS video_count
  FROM vehicle_videos vv
  WHERE vv.generation_id = g.id
) video_stats ON true;
