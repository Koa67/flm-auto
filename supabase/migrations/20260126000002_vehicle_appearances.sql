-- FLM AUTO - Vehicle Appearances Migration
-- Table for IMCDB/IGCD data (Screen Cars module)

-- Enable UUID if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vehicle appearances in movies/TV/games
CREATE TABLE IF NOT EXISTS vehicle_appearances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- IMCDB identifiers
    imcdb_vehicle_id TEXT UNIQUE,
    imcdb_movie_id TEXT,
    
    -- Vehicle info
    vehicle_year INTEGER,
    vehicle_make TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    chassis_code TEXT,
    
    -- Link to our database (optional - matched after import)
    generation_id UUID REFERENCES generations(id) ON DELETE SET NULL,
    
    -- Media info
    movie_title TEXT NOT NULL,
    movie_year INTEGER,
    media_type TEXT DEFAULT 'movie' CHECK (media_type IN ('movie', 'tv_series', 'video_game', 'music_video', 'documentary', 'commercial', 'other')),
    
    -- Additional info
    role_importance TEXT CHECK (role_importance IN ('star', 'featured', 'background')),
    episode_info TEXT,
    screenshot_url TEXT,
    imcdb_url TEXT,
    
    -- For IGCD (video games)
    igcd_vehicle_id TEXT,
    igcd_game_id TEXT,
    igcd_url TEXT,
    
    -- Metadata
    is_verified BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_appearances_make ON vehicle_appearances(vehicle_make);
CREATE INDEX IF NOT EXISTS idx_vehicle_appearances_chassis ON vehicle_appearances(chassis_code);
CREATE INDEX IF NOT EXISTS idx_vehicle_appearances_movie ON vehicle_appearances(movie_title);
CREATE INDEX IF NOT EXISTS idx_vehicle_appearances_year ON vehicle_appearances(movie_year);
CREATE INDEX IF NOT EXISTS idx_vehicle_appearances_media_type ON vehicle_appearances(media_type);
CREATE INDEX IF NOT EXISTS idx_vehicle_appearances_generation ON vehicle_appearances(generation_id);

-- Full text search on movie title
CREATE INDEX IF NOT EXISTS idx_vehicle_appearances_movie_fts ON vehicle_appearances 
    USING gin(to_tsvector('english', movie_title));

-- Media (movies/shows/games) reference table
CREATE TABLE IF NOT EXISTS media_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- External IDs
    imcdb_id TEXT UNIQUE,
    igcd_id TEXT UNIQUE,
    imdb_id TEXT,
    tmdb_id TEXT,
    
    -- Basic info
    title TEXT NOT NULL,
    original_title TEXT,
    year INTEGER,
    end_year INTEGER, -- For TV series
    media_type TEXT DEFAULT 'movie' CHECK (media_type IN ('movie', 'tv_series', 'video_game', 'music_video', 'documentary', 'commercial', 'other')),
    
    -- Additional info
    director TEXT,
    country TEXT,
    poster_url TEXT,
    description TEXT,
    
    -- Stats
    vehicle_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for media_references
CREATE INDEX IF NOT EXISTS idx_media_references_title ON media_references(title);
CREATE INDEX IF NOT EXISTS idx_media_references_year ON media_references(year);
CREATE INDEX IF NOT EXISTS idx_media_references_type ON media_references(media_type);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_vehicle_appearances_updated_at ON vehicle_appearances;
CREATE TRIGGER update_vehicle_appearances_updated_at
    BEFORE UPDATE ON vehicle_appearances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_media_references_updated_at ON media_references;
CREATE TRIGGER update_media_references_updated_at
    BEFORE UPDATE ON media_references
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to match appearances to our generations
CREATE OR REPLACE FUNCTION match_appearance_to_generation(
    p_make TEXT,
    p_chassis_code TEXT,
    p_year INTEGER
) RETURNS UUID AS $$
DECLARE
    v_generation_id UUID;
BEGIN
    -- Try exact chassis code match first
    IF p_chassis_code IS NOT NULL THEN
        SELECT g.id INTO v_generation_id
        FROM generations g
        JOIN models m ON g.model_id = m.id
        JOIN brands b ON m.brand_id = b.id
        WHERE b.name ILIKE p_make
        AND g.internal_code ILIKE p_chassis_code
        LIMIT 1;
        
        IF v_generation_id IS NOT NULL THEN
            RETURN v_generation_id;
        END IF;
    END IF;
    
    -- Try year match
    IF p_year IS NOT NULL THEN
        SELECT g.id INTO v_generation_id
        FROM generations g
        JOIN models m ON g.model_id = m.id
        JOIN brands b ON m.brand_id = b.id
        WHERE b.name ILIKE p_make
        AND (g.production_start IS NULL OR EXTRACT(YEAR FROM g.production_start) <= p_year)
        AND (g.production_end IS NULL OR EXTRACT(YEAR FROM g.production_end) >= p_year)
        LIMIT 1;
        
        RETURN v_generation_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- View for popular screen cars
CREATE OR REPLACE VIEW v_popular_screen_cars AS
SELECT 
    va.vehicle_make,
    va.vehicle_model,
    va.chassis_code,
    COUNT(*) as appearance_count,
    COUNT(DISTINCT va.movie_title) as unique_movies,
    COUNT(*) FILTER (WHERE va.role_importance = 'star') as star_roles,
    COUNT(*) FILTER (WHERE va.role_importance = 'featured') as featured_roles,
    array_agg(DISTINCT va.movie_title ORDER BY va.movie_title) FILTER (WHERE va.role_importance IN ('star', 'featured')) as notable_movies
FROM vehicle_appearances va
GROUP BY va.vehicle_make, va.vehicle_model, va.chassis_code
HAVING COUNT(*) >= 5
ORDER BY appearance_count DESC;

-- View for popular movies with our brands
CREATE OR REPLACE VIEW v_movies_with_our_brands AS
SELECT 
    va.movie_title,
    va.movie_year,
    va.media_type,
    COUNT(*) as vehicle_count,
    COUNT(DISTINCT va.vehicle_make) as brand_count,
    array_agg(DISTINCT va.vehicle_make) as brands,
    array_agg(DISTINCT va.chassis_code) FILTER (WHERE va.chassis_code IS NOT NULL) as chassis_codes
FROM vehicle_appearances va
WHERE va.vehicle_make IN ('BMW', 'Mercedes-Benz', 'Lamborghini')
GROUP BY va.movie_title, va.movie_year, va.media_type
HAVING COUNT(*) >= 2
ORDER BY vehicle_count DESC;

COMMENT ON TABLE vehicle_appearances IS 'Vehicle appearances in movies, TV shows, and video games. Source: IMCDB/IGCD';
COMMENT ON TABLE media_references IS 'Reference table for movies, TV shows, and video games';
