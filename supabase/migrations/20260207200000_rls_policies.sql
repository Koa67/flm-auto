-- ============================================================
-- RLS Policies — Protect all tables
-- ============================================================

-- CRITICAL: newsletter_subscribers contains PII (emails)
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only read" ON newsletter_subscribers
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Anon can insert" ON newsletter_subscribers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role only update" ON newsletter_subscribers
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role only delete" ON newsletter_subscribers
  FOR DELETE USING (auth.role() = 'service_role');

-- Public data tables: read-only for anonymous users
-- Brands
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read brands" ON brands FOR SELECT USING (true);
CREATE POLICY "No public write brands" ON brands FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "No public update brands" ON brands FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "No public delete brands" ON brands FOR DELETE USING (auth.role() = 'service_role');

-- Models
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read models" ON models FOR SELECT USING (true);
CREATE POLICY "No public write models" ON models FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "No public update models" ON models FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "No public delete models" ON models FOR DELETE USING (auth.role() = 'service_role');

-- Generations
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read generations" ON generations FOR SELECT USING (true);
CREATE POLICY "No public write generations" ON generations FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "No public update generations" ON generations FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "No public delete generations" ON generations FOR DELETE USING (auth.role() = 'service_role');

-- Engine variants
ALTER TABLE engine_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read engine_variants" ON engine_variants FOR SELECT USING (true);
CREATE POLICY "No public write engine_variants" ON engine_variants FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "No public update engine_variants" ON engine_variants FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "No public delete engine_variants" ON engine_variants FOR DELETE USING (auth.role() = 'service_role');

-- Vehicle images
ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read vehicle_images" ON vehicle_images FOR SELECT USING (true);
CREATE POLICY "No public write vehicle_images" ON vehicle_images FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "No public update vehicle_images" ON vehicle_images FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "No public delete vehicle_images" ON vehicle_images FOR DELETE USING (auth.role() = 'service_role');

-- Safety ratings
ALTER TABLE safety_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read safety_ratings" ON safety_ratings FOR SELECT USING (true);
CREATE POLICY "No public write safety_ratings" ON safety_ratings FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "No public update safety_ratings" ON safety_ratings FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "No public delete safety_ratings" ON safety_ratings FOR DELETE USING (auth.role() = 'service_role');

-- Third party specs
ALTER TABLE third_party_specs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read third_party_specs" ON third_party_specs FOR SELECT USING (true);
CREATE POLICY "No public write third_party_specs" ON third_party_specs FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "No public update third_party_specs" ON third_party_specs FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "No public delete third_party_specs" ON third_party_specs FOR DELETE USING (auth.role() = 'service_role');

-- Family fit compatibility
ALTER TABLE family_fit_compatibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read family_fit_compatibility" ON family_fit_compatibility FOR SELECT USING (true);
CREATE POLICY "No public write family_fit_compatibility" ON family_fit_compatibility FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "No public update family_fit_compatibility" ON family_fit_compatibility FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "No public delete family_fit_compatibility" ON family_fit_compatibility FOR DELETE USING (auth.role() = 'service_role');

-- Vehicle appearances (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'vehicle_appearances') THEN
    ALTER TABLE vehicle_appearances ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Public read vehicle_appearances" ON vehicle_appearances FOR SELECT USING (true);
    CREATE POLICY "No public write vehicle_appearances" ON vehicle_appearances FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Vehicle pricing (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'vehicle_pricing') THEN
    ALTER TABLE vehicle_pricing ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Public read vehicle_pricing" ON vehicle_pricing FOR SELECT USING (true);
    CREATE POLICY "No public write vehicle_pricing" ON vehicle_pricing FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
