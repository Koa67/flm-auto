-- Phase 4: Trims, Equipment, UX Ratings, Reliability

-- =============================================
-- FINITIONS & ÉQUIPEMENTS
-- =============================================

CREATE TABLE IF NOT EXISTS trims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  marketing_name TEXT,
  base_price INTEGER,
  is_base_trim BOOLEAN DEFAULT false,
  sort_order INTEGER,
  summary_fr TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(generation_id, name)
);

CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_fr TEXT NOT NULL,
  category TEXT NOT NULL,
  description_fr TEXT,
  is_essential BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS trim_equipment (
  trim_id UUID REFERENCES trims(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'standard',
  option_price INTEGER,
  pack_name TEXT,
  PRIMARY KEY (trim_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_trims_generation ON trims(generation_id);
CREATE INDEX IF NOT EXISTS idx_trim_equipment_trim ON trim_equipment(trim_id);

-- =============================================
-- UX INTÉRIEUR
-- =============================================

CREATE TABLE IF NOT EXISTS ux_ratings (
  generation_id UUID PRIMARY KEY REFERENCES generations(id),

  -- Commandes
  physical_buttons_climate INTEGER CHECK (physical_buttons_climate BETWEEN 1 AND 10),
  physical_buttons_volume INTEGER CHECK (physical_buttons_volume BETWEEN 1 AND 10),
  physical_buttons_other INTEGER CHECK (physical_buttons_other BETWEEN 1 AND 10),

  -- Écran
  screen_size_inches DECIMAL(3,1),
  screen_responsiveness INTEGER CHECK (screen_responsiveness BETWEEN 1 AND 10),
  screen_lag_ms INTEGER,
  screen_glare_resistance INTEGER CHECK (screen_glare_resistance BETWEEN 1 AND 10),
  menu_depth INTEGER,

  -- Ergonomie
  steering_wheel_buttons INTEGER CHECK (steering_wheel_buttons BETWEEN 1 AND 10),
  gear_selector_usability INTEGER CHECK (gear_selector_usability BETWEEN 1 AND 10),
  turn_signal_stalk BOOLEAN DEFAULT true,
  wiper_stalk BOOLEAN DEFAULT true,

  -- Visibilité
  visibility_front INTEGER CHECK (visibility_front BETWEEN 1 AND 10),
  visibility_rear INTEGER CHECK (visibility_rear BETWEEN 1 AND 10),
  visibility_three_quarters INTEGER CHECK (visibility_three_quarters BETWEEN 1 AND 10),
  pillar_a_thickness_mm INTEGER,

  -- Confort sièges
  seat_comfort_short INTEGER CHECK (seat_comfort_short BETWEEN 1 AND 10),
  seat_comfort_long INTEGER CHECK (seat_comfort_long BETWEEN 1 AND 10),
  seat_adjustments_driver INTEGER,
  seat_adjustments_passenger INTEGER,
  lumbar_support BOOLEAN DEFAULT false,
  massage_function BOOLEAN DEFAULT false,
  ventilated_seats BOOLEAN DEFAULT false,

  -- Bruit
  noise_level_idle_db INTEGER,
  noise_level_city_db INTEGER,
  noise_level_highway_db INTEGER,

  -- Tech
  wireless_carplay BOOLEAN DEFAULT false,
  wireless_android_auto BOOLEAN DEFAULT false,
  usb_ports_front INTEGER DEFAULT 0,
  usb_ports_rear INTEGER DEFAULT 0,
  usb_type_c BOOLEAN DEFAULT false,
  wireless_charging BOOLEAN DEFAULT false,
  hud_available BOOLEAN DEFAULT false,

  -- Qualité
  materials_quality INTEGER CHECK (materials_quality BETWEEN 1 AND 10),
  soft_touch_surfaces INTEGER CHECK (soft_touch_surfaces BETWEEN 1 AND 10),
  squeaks_rattles INTEGER CHECK (squeaks_rattles BETWEEN 1 AND 10),

  -- Scores calculés
  overall_ux_score INTEGER,
  family_friendly_score INTEGER,
  senior_friendly_score INTEGER,

  source TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- FIABILITÉ & RED FLAGS
-- =============================================

CREATE TABLE IF NOT EXISTS reliability_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES generations(id),
  engine_code TEXT,

  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL,

  title TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  description TEXT,
  description_fr TEXT,

  symptoms TEXT[],
  symptoms_fr TEXT[],

  affected_years INTEGER[],
  affected_km_min INTEGER,
  affected_km_max INTEGER,

  repair_cost_eur_min INTEGER,
  repair_cost_eur_max INTEGER,

  source TEXT,
  source_url TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reliability_issues_generation ON reliability_issues(generation_id);
CREATE INDEX IF NOT EXISTS idx_reliability_issues_engine ON reliability_issues(engine_code);

-- =============================================
-- SEED: ÉQUIPEMENTS DE BASE
-- =============================================

INSERT INTO equipment (name, name_fr, category, is_essential) VALUES
  -- Sécurité
  ('adaptive_cruise_control', 'Régulateur adaptatif', 'safety', true),
  ('lane_keep_assist', 'Aide au maintien de voie', 'safety', true),
  ('automatic_emergency_braking', 'Freinage d''urgence automatique', 'safety', true),
  ('blind_spot_monitoring', 'Surveillance angles morts', 'safety', true),
  ('rear_cross_traffic_alert', 'Alerte trafic arrière', 'safety', false),
  ('360_camera', 'Caméra 360°', 'safety', false),
  ('parking_sensors_front', 'Capteurs avant', 'safety', false),
  ('parking_sensors_rear', 'Capteurs arrière', 'safety', true),
  -- Confort
  ('heated_seats_front', 'Sièges chauffants avant', 'comfort', false),
  ('heated_seats_rear', 'Sièges chauffants arrière', 'comfort', false),
  ('ventilated_seats', 'Sièges ventilés', 'comfort', false),
  ('heated_steering_wheel', 'Volant chauffant', 'comfort', false),
  ('dual_zone_climate', 'Clim bi-zone', 'comfort', false),
  ('tri_zone_climate', 'Clim tri-zone', 'comfort', false),
  ('panoramic_roof', 'Toit panoramique', 'comfort', false),
  ('power_tailgate', 'Hayon électrique', 'comfort', false),
  ('hands_free_tailgate', 'Hayon mains libres', 'comfort', false),
  -- Technologie
  ('wireless_carplay', 'CarPlay sans fil', 'tech', true),
  ('wireless_android_auto', 'Android Auto sans fil', 'tech', true),
  ('wireless_charging', 'Charge sans fil', 'tech', false),
  ('head_up_display', 'Affichage tête haute', 'tech', false),
  ('digital_cockpit', 'Cockpit digital', 'tech', false),
  ('premium_audio', 'Audio premium', 'tech', false),
  -- Extérieur
  ('led_headlights', 'Phares LED', 'exterior', true),
  ('matrix_led', 'Matrix LED', 'exterior', false),
  ('power_folding_mirrors', 'Rétros rabattables élec.', 'exterior', false),
  ('alloy_wheels_17', 'Jantes alu 17"', 'exterior', false),
  ('alloy_wheels_18', 'Jantes alu 18"', 'exterior', false),
  ('alloy_wheels_19', 'Jantes alu 19"', 'exterior', false),
  -- Intérieur
  ('leather_seats', 'Sellerie cuir', 'interior', false),
  ('alcantara_seats', 'Sellerie Alcantara', 'interior', false),
  ('ambient_lighting', 'Éclairage d''ambiance', 'interior', false),
  ('electric_seats_driver', 'Siège conducteur électrique', 'interior', false),
  ('electric_seats_passenger', 'Siège passager électrique', 'interior', false),
  ('memory_seats', 'Sièges à mémoire', 'interior', false),
  -- Pratique
  ('keyless_entry', 'Accès sans clé', 'practical', false),
  ('keyless_start', 'Démarrage sans clé', 'practical', false),
  ('split_folding_rear_seats', 'Banquette 40/20/40', 'practical', true),
  ('roof_rails', 'Barres de toit', 'practical', false),
  ('tow_hitch_prep', 'Préparation attelage', 'practical', false)
ON CONFLICT (name) DO NOTHING;
