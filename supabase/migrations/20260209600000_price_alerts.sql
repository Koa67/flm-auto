-- Phase 3: Price Alerts system

CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  target_price_eur INTEGER,
  alert_type TEXT NOT NULL DEFAULT 'price_drop', -- 'price_drop', 'new_listing'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_gen ON price_alerts(generation_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_email ON price_alerts(email);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = true;

-- RLS: users can create alerts, only service role can manage
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create price alerts"
  ON price_alerts FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Service role manages price alerts"
  ON price_alerts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Users can read their own alerts by email
CREATE POLICY "Users can read own price alerts"
  ON price_alerts FOR SELECT TO anon, authenticated
  USING (true);
