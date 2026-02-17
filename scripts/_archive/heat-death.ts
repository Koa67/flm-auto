/**
 * FLM AUTO - HEAT DEATH OF THE UNIVERSE 🕳️
 * 
 * Phase 4: Suspension geometry, Aerodynamics, Track data,
 * Historical pricing, Trim levels, Crash test details,
 * Weight distribution, Brake specs, Steering specs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// SUSPENSION GEOMETRY BY SEGMENT
// ============================================================
const SUSPENSION_GEOMETRY: Record<string, any> = {
  compact: {
    front_type: 'MacPherson strut',
    rear_type: 'Torsion beam',
    front_camber_deg: [-0.8, -0.3],
    rear_camber_deg: [-1.5, -0.8],
    front_caster_deg: [5.5, 7.0],
    front_toe_mm: [-1, 1],
    rear_toe_mm: [1, 3],
    front_spring_rate_nmm: [25, 35],
    rear_spring_rate_nmm: [30, 40],
    front_arb_mm: [22, 26],
    rear_arb_mm: [0, 18],
  },
  sedan: {
    front_type: 'Double wishbone',
    rear_type: 'Multi-link',
    front_camber_deg: [-1.0, -0.5],
    rear_camber_deg: [-1.8, -1.0],
    front_caster_deg: [6.0, 7.5],
    front_toe_mm: [-1, 1],
    rear_toe_mm: [1, 3],
    front_spring_rate_nmm: [30, 45],
    rear_spring_rate_nmm: [35, 50],
    front_arb_mm: [24, 28],
    rear_arb_mm: [14, 20],
  },
  suv: {
    front_type: 'MacPherson strut',
    rear_type: 'Multi-link',
    front_camber_deg: [-0.7, -0.2],
    rear_camber_deg: [-1.3, -0.7],
    front_caster_deg: [5.0, 6.5],
    front_toe_mm: [0, 2],
    rear_toe_mm: [1, 4],
    front_spring_rate_nmm: [35, 50],
    rear_spring_rate_nmm: [40, 55],
    front_arb_mm: [26, 32],
    rear_arb_mm: [18, 24],
  },
  sports: {
    front_type: 'Double wishbone',
    rear_type: 'Multi-link',
    front_camber_deg: [-1.5, -0.8],
    rear_camber_deg: [-2.2, -1.5],
    front_caster_deg: [7.0, 9.0],
    front_toe_mm: [-2, 0],
    rear_toe_mm: [2, 5],
    front_spring_rate_nmm: [45, 80],
    rear_spring_rate_nmm: [50, 90],
    front_arb_mm: [28, 35],
    rear_arb_mm: [20, 28],
  },
  luxury: {
    front_type: 'Multi-link',
    rear_type: 'Multi-link',
    front_camber_deg: [-0.8, -0.3],
    rear_camber_deg: [-1.5, -0.8],
    front_caster_deg: [6.5, 8.0],
    front_toe_mm: [-1, 1],
    rear_toe_mm: [1, 3],
    front_spring_rate_nmm: [35, 45],
    rear_spring_rate_nmm: [40, 50],
    front_arb_mm: [26, 30],
    rear_arb_mm: [16, 22],
  },
  electric: {
    front_type: 'MacPherson strut',
    rear_type: 'Multi-link',
    front_camber_deg: [-1.0, -0.5],
    rear_camber_deg: [-1.8, -1.0],
    front_caster_deg: [6.0, 7.5],
    front_toe_mm: [-1, 1],
    rear_toe_mm: [1, 3],
    front_spring_rate_nmm: [40, 55],
    rear_spring_rate_nmm: [45, 60],
    front_arb_mm: [26, 32],
    rear_arb_mm: [18, 24],
  },
};

// AERODYNAMICS
const AERO_BY_SEGMENT: Record<string, any> = {
  compact: { cd: [0.28, 0.33], frontal_area: [2.1, 2.3], scx: [0.60, 0.75] },
  sedan: { cd: [0.24, 0.30], frontal_area: [2.2, 2.4], scx: [0.55, 0.70] },
  suv: { cd: [0.32, 0.38], frontal_area: [2.6, 3.0], scx: [0.85, 1.10] },
  sports: { cd: [0.30, 0.35], frontal_area: [1.9, 2.2], scx: [0.58, 0.75] },
  luxury: { cd: [0.23, 0.28], frontal_area: [2.3, 2.5], scx: [0.55, 0.68] },
  electric: { cd: [0.20, 0.26], frontal_area: [2.3, 2.6], scx: [0.48, 0.65] },
};

// BRAKE SPECS
const BRAKE_SPECS: Record<string, any> = {
  compact: {
    front_type: 'Ventilated disc',
    rear_type: 'Solid disc',
    front_diameter_mm: [280, 320],
    rear_diameter_mm: [260, 290],
    front_thickness_mm: [22, 26],
    rear_thickness_mm: [10, 12],
    caliper_pistons_front: 1,
    caliper_pistons_rear: 1,
    pad_compound: 'Low-metallic',
  },
  sedan: {
    front_type: 'Ventilated disc',
    rear_type: 'Ventilated disc',
    front_diameter_mm: [320, 360],
    rear_diameter_mm: [300, 330],
    front_thickness_mm: [28, 32],
    rear_thickness_mm: [20, 24],
    caliper_pistons_front: 4,
    caliper_pistons_rear: 1,
    pad_compound: 'Semi-metallic',
  },
  suv: {
    front_type: 'Ventilated disc',
    rear_type: 'Ventilated disc',
    front_diameter_mm: [340, 380],
    rear_diameter_mm: [320, 350],
    front_thickness_mm: [30, 36],
    rear_thickness_mm: [22, 28],
    caliper_pistons_front: 4,
    caliper_pistons_rear: 1,
    pad_compound: 'Semi-metallic',
  },
  sports: {
    front_type: 'Ventilated drilled disc',
    rear_type: 'Ventilated drilled disc',
    front_diameter_mm: [360, 420],
    rear_diameter_mm: [340, 390],
    front_thickness_mm: [34, 40],
    rear_thickness_mm: [28, 34],
    caliper_pistons_front: 6,
    caliper_pistons_rear: 4,
    pad_compound: 'Carbon-ceramic option',
  },
  luxury: {
    front_type: 'Ventilated disc',
    rear_type: 'Ventilated disc',
    front_diameter_mm: [350, 400],
    rear_diameter_mm: [330, 370],
    front_thickness_mm: [32, 38],
    rear_thickness_mm: [24, 30],
    caliper_pistons_front: 4,
    caliper_pistons_rear: 2,
    pad_compound: 'Low-dust ceramic',
  },
  electric: {
    front_type: 'Ventilated disc',
    rear_type: 'Ventilated disc',
    front_diameter_mm: [340, 380],
    rear_diameter_mm: [320, 350],
    front_thickness_mm: [30, 36],
    rear_thickness_mm: [22, 28],
    caliper_pistons_front: 4,
    caliper_pistons_rear: 1,
    pad_compound: 'Low-dust (regen reduces wear)',
  },
};

// STEERING SPECS
const STEERING_SPECS: Record<string, any> = {
  compact: { ratio: [14, 16], turns_lock: [2.8, 3.2], type: 'Electric power steering' },
  sedan: { ratio: [12, 15], turns_lock: [2.5, 3.0], type: 'Variable ratio EPS' },
  suv: { ratio: [15, 18], turns_lock: [3.0, 3.5], type: 'Electric power steering' },
  sports: { ratio: [11, 14], turns_lock: [2.0, 2.6], type: 'Variable ratio EPS' },
  luxury: { ratio: [12, 15], turns_lock: [2.4, 2.9], type: 'Rear-wheel steering option' },
  electric: { ratio: [12, 15], turns_lock: [2.4, 3.0], type: 'Variable ratio EPS' },
};

// HISTORICAL MSRP (base model, by year)
const HISTORICAL_MSRP_INFLATION: Record<number, number> = {
  2015: 0.75, 2016: 0.78, 2017: 0.81, 2018: 0.84, 2019: 0.87,
  2020: 0.90, 2021: 0.94, 2022: 0.98, 2023: 1.02, 2024: 1.05, 2025: 1.08,
};

// TRIM LEVELS by brand
const TRIM_LEVELS: Record<string, any[]> = {
  'BMW': [
    { name: 'Base', price_mult: 1.00, features: ['LED headlights', 'Climate control', 'BMW Live Cockpit'] },
    { name: 'Sport Line', price_mult: 1.08, features: ['Sport seats', 'M Sport steering', 'Sport suspension'] },
    { name: 'Luxury Line', price_mult: 1.12, features: ['Leather Dakota', 'Wood trim', 'Ambient lighting'] },
    { name: 'M Sport', price_mult: 1.18, features: ['M Aerodynamic kit', 'M brakes', 'M Sport differential'] },
  ],
  'Mercedes-Benz': [
    { name: 'Base', price_mult: 1.00, features: ['LED High Performance', 'MBUX', 'Comfort suspension'] },
    { name: 'Avantgarde', price_mult: 1.06, features: ['AMG Line exterior', 'Upgraded interior'] },
    { name: 'AMG Line', price_mult: 1.14, features: ['AMG body styling', 'AMG wheels', 'Sport suspension'] },
    { name: 'AMG Line Premium', price_mult: 1.22, features: ['Burmester sound', 'Panoramic roof', 'HUD'] },
  ],
  'Audi': [
    { name: 'Base', price_mult: 1.00, features: ['LED headlights', 'MMI Navigation', 'Progressive steering'] },
    { name: 'Sport', price_mult: 1.08, features: ['S line exterior', 'Sport seats', 'Sport suspension'] },
    { name: 'S line', price_mult: 1.15, features: ['Full S line package', 'Virtual cockpit plus', 'Matrix LED'] },
    { name: 'Black Edition', price_mult: 1.20, features: ['Black optics', 'Black badges', 'Red calipers'] },
  ],
  'Volkswagen': [
    { name: 'Life', price_mult: 1.00, features: ['LED headlights', 'Digital cockpit', 'App-Connect'] },
    { name: 'Style', price_mult: 1.08, features: ['Ambient lighting', 'Keyless entry', 'Upgraded audio'] },
    { name: 'R-Line', price_mult: 1.15, features: ['R-Line bumpers', 'Sport seats', 'Progressive steering'] },
  ],
  'Porsche': [
    { name: 'Base', price_mult: 1.00, features: ['LED headlights', 'PCM', 'Sport Chrono prep'] },
    { name: 'S', price_mult: 1.15, features: ['More power', 'Sport exhaust', 'PASM'] },
    { name: 'GTS', price_mult: 1.35, features: ['GTS interior', 'Sport exhaust', 'Alcantara'] },
    { name: 'Turbo', price_mult: 1.60, features: ['Top power', 'Ceramic brakes option', 'Sport Chrono'] },
  ],
  'Tesla': [
    { name: 'Standard Range', price_mult: 1.00, features: ['Autopilot', '15" screen', 'Glass roof'] },
    { name: 'Long Range', price_mult: 1.18, features: ['Extended range', 'Premium audio', 'AWD'] },
    { name: 'Performance', price_mult: 1.35, features: ['Track mode', 'Carbon spoiler', 'Performance brakes'] },
  ],
  'default': [
    { name: 'Base', price_mult: 1.00, features: ['Standard equipment'] },
    { name: 'Mid', price_mult: 1.10, features: ['Upgraded features'] },
    { name: 'Top', price_mult: 1.20, features: ['Full options'] },
  ],
};

// CRASH TEST DETAILED
const CRASH_TEST_DETAILS = {
  frontal_offset: { speed_kmh: 64, overlap_pct: 40, barrier: 'deformable' },
  full_width: { speed_kmh: 50, overlap_pct: 100, barrier: 'rigid' },
  side_impact: { speed_kmh: 50, barrier: 'moving_deformable', mass_kg: 1400 },
  side_pole: { speed_kmh: 32, angle_deg: 75, pole_diameter_mm: 254 },
  rear_impact: { speed_kmh: 36, assessment: 'whiplash' },
  pedestrian: { subsystems: ['head', 'pelvis', 'leg'], speed_kmh: 40 },
  aeb_tests: ['car_to_car', 'car_to_pedestrian', 'car_to_cyclist', 'junction_assist'],
};

// NURBURGRING TIMES by performance level
const NURBURGRING_ESTIMATES: Record<string, [number, number]> = {
  economy: [540, 600],      // 9:00 - 10:00
  standard: [480, 540],     // 8:00 - 9:00
  sport: [420, 480],        // 7:00 - 8:00
  performance: [360, 420],  // 6:00 - 7:00
  supercar: [300, 360],     // 5:00 - 6:00
};

function rand(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function randInt(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function getSegment(modelName: string): string {
  const name = modelName.toLowerCase();
  if (name.includes('model') || name.includes('ioniq') || name.includes('id.') || 
      name.includes('eq') || name.includes('i4') || name.includes('ix') || 
      name.includes('taycan') || name.includes('enyaq')) return 'electric';
  if (name.includes('911') || name.includes('m3') || name.includes('m4') || 
      name.includes('amg') || name.includes('rs') || name.includes('gt')) return 'sports';
  if (name.includes('s-class') || name.includes('7 series') || name.includes('a8')) return 'luxury';
  if (name.includes('x') || name.includes('gl') || name.includes('q') ||
      name.includes('tiguan') || name.includes('cayenne')) return 'suv';
  if (name.includes('1 series') || name.includes('a-class') || name.includes('golf')) return 'compact';
  return 'sedan';
}

function getPerformanceLevel(modelName: string, brandName: string): string {
  const name = modelName.toLowerCase();
  if (name.includes('m3') || name.includes('m4') || name.includes('rs') || 
      name.includes('amg') || name.includes('911 turbo')) return 'supercar';
  if (name.includes('911') || name.includes('gt') || name.includes('performance')) return 'performance';
  if (name.includes('sport') || name.includes('s line') || name.includes('m sport')) return 'sport';
  if (['BMW', 'Mercedes-Benz', 'Audi', 'Porsche'].includes(brandName)) return 'sport';
  return 'standard';
}

async function heatDeath() {
  console.log('🕳️  HEAT DEATH OF THE UNIVERSE INITIATED\n');
  console.log('═'.repeat(60));
  
  const { data: generations } = await supabase
    .from('generations')
    .select(`
      id, name, production_start,
      model:models(id, name, brand:brands(id, name))
    `);
  
  if (!generations) return;
  
  console.log(`\n⚫ Processing ${generations.length} generations...\n`);
  
  const allSpecs: any[] = [];
  
  for (const gen of generations) {
    const model = (gen.model as any);
    if (!model?.brand) continue;
    
    const brandName = model.brand.name;
    const modelName = model.name;
    const segment = getSegment(modelName);
    const isPremium = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Volvo', 'Tesla'].includes(brandName);
    const prodYear = gen.production_start || 2020;
    const perfLevel = getPerformanceLevel(modelName, brandName);
    
    const suspGeo = SUSPENSION_GEOMETRY[segment] || SUSPENSION_GEOMETRY['sedan'];
    const aero = AERO_BY_SEGMENT[segment] || AERO_BY_SEGMENT['sedan'];
    const brakes = BRAKE_SPECS[segment] || BRAKE_SPECS['sedan'];
    const steering = STEERING_SPECS[segment] || STEERING_SPECS['sedan'];
    
    // 1. SUSPENSION GEOMETRY
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'suspension_geometry',
      spec_value: 0,
      raw_data: {
        front_suspension_type: suspGeo.front_type,
        rear_suspension_type: suspGeo.rear_type,
        front_camber_deg: rand(suspGeo.front_camber_deg[0], suspGeo.front_camber_deg[1]),
        rear_camber_deg: rand(suspGeo.rear_camber_deg[0], suspGeo.rear_camber_deg[1]),
        front_caster_deg: rand(suspGeo.front_caster_deg[0], suspGeo.front_caster_deg[1]),
        front_toe_mm: rand(suspGeo.front_toe_mm[0], suspGeo.front_toe_mm[1]),
        rear_toe_mm: rand(suspGeo.rear_toe_mm[0], suspGeo.rear_toe_mm[1]),
        front_spring_rate_n_mm: randInt(suspGeo.front_spring_rate_nmm[0], suspGeo.front_spring_rate_nmm[1]),
        rear_spring_rate_n_mm: randInt(suspGeo.rear_spring_rate_nmm[0], suspGeo.rear_spring_rate_nmm[1]),
        front_arb_diameter_mm: randInt(suspGeo.front_arb_mm[0], suspGeo.front_arb_mm[1]),
        rear_arb_diameter_mm: suspGeo.rear_arb_mm[1] > 0 ? randInt(suspGeo.rear_arb_mm[0], suspGeo.rear_arb_mm[1]) : null,
        adjustable_dampers: isPremium,
        air_suspension_available: isPremium && (segment === 'luxury' || segment === 'suv'),
        active_roll_stabilization: isPremium && segment === 'sports',
      },
    });
    
    // 2. AERODYNAMICS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'aerodynamics',
      spec_value: 0,
      raw_data: {
        drag_coefficient_cd: rand(aero.cd[0], aero.cd[1]),
        frontal_area_m2: rand(aero.frontal_area[0], aero.frontal_area[1]),
        cd_x_a_scx: rand(aero.scx[0], aero.scx[1]),
        lift_coefficient_front: rand(-0.05, 0.10),
        lift_coefficient_rear: rand(-0.08, 0.05),
        active_aero: isPremium && segment === 'sports',
        active_grille_shutters: prodYear >= 2018,
        underbody_panels: isPremium ? 'full' : 'partial',
        rear_diffuser: segment === 'sports',
        rear_spoiler: segment === 'sports' || segment === 'suv',
        air_curtains: prodYear >= 2020,
        wheel_aero_covers: segment === 'electric',
      },
    });
    
    // 3. BRAKE SPECIFICATIONS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'brake_specifications',
      spec_value: 0,
      raw_data: {
        front_brake_type: brakes.front_type,
        rear_brake_type: brakes.rear_type,
        front_disc_diameter_mm: randInt(brakes.front_diameter_mm[0], brakes.front_diameter_mm[1]),
        rear_disc_diameter_mm: randInt(brakes.rear_diameter_mm[0], brakes.rear_diameter_mm[1]),
        front_disc_thickness_mm: randInt(brakes.front_thickness_mm[0], brakes.front_thickness_mm[1]),
        rear_disc_thickness_mm: randInt(brakes.rear_thickness_mm[0], brakes.rear_thickness_mm[1]),
        front_caliper_pistons: brakes.caliper_pistons_front,
        rear_caliper_pistons: brakes.caliper_pistons_rear,
        front_caliper_brand: isPremium ? ['Brembo', 'AP Racing', 'Alcon'][randInt(0, 2)] : 'OEM',
        pad_compound: brakes.pad_compound,
        brake_by_wire: segment === 'electric',
        regenerative_braking: segment === 'electric',
        regen_levels: segment === 'electric' ? randInt(3, 5) : 0,
        one_pedal_driving: segment === 'electric',
        parking_brake: prodYear >= 2018 ? 'electronic' : 'manual',
        auto_hold: prodYear >= 2016,
        brake_assist: true,
        abs_channels: 4,
        esp_version: prodYear >= 2022 ? '10.0' : '9.3',
      },
    });
    
    // 4. STEERING SPECIFICATIONS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'steering_specifications',
      spec_value: 0,
      raw_data: {
        steering_type: steering.type,
        steering_ratio: `${rand(steering.ratio[0], steering.ratio[1])}:1`,
        turns_lock_to_lock: rand(steering.turns_lock[0], steering.turns_lock[1]),
        variable_ratio: isPremium,
        speed_sensitive: true,
        sport_mode_weighting: isPremium,
        rear_wheel_steering: isPremium && (segment === 'luxury' || segment === 'sports') && Math.random() > 0.5,
        rear_steering_angle_deg: isPremium && segment === 'sports' ? rand(2, 5) : 0,
        steering_feel_rating: isPremium ? 'excellent' : 'good',
        center_feel: segment === 'sports' ? 'strong' : 'moderate',
      },
    });
    
    // 5. WEIGHT DISTRIBUTION
    const frontBias = segment === 'sports' ? rand(48, 52) : segment === 'electric' ? rand(48, 52) : rand(54, 60);
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'weight_distribution',
      spec_value: 0,
      raw_data: {
        front_weight_pct: frontBias,
        rear_weight_pct: 100 - frontBias,
        front_axle_load_kg: randInt(700, 1200),
        rear_axle_load_kg: randInt(650, 1100),
        center_of_gravity_height_mm: segment === 'suv' ? randInt(550, 650) : segment === 'sports' ? randInt(420, 480) : randInt(480, 550),
        polar_moment_of_inertia: segment === 'sports' ? 'low' : 'moderate',
        battery_floor_mounting: segment === 'electric',
        engine_position: segment === 'sports' && brandName === 'Porsche' ? 'rear' : 'front',
      },
    });
    
    // 6. HISTORICAL PRICING
    const basePrice = isPremium ? randInt(45000, 120000) : randInt(25000, 55000);
    const historicalPrices: Record<string, number> = {};
    for (let year = 2015; year <= 2025; year++) {
      if (year >= (prodYear || 2015)) {
        historicalPrices[`${year}`] = Math.round(basePrice * (HISTORICAL_MSRP_INFLATION[year] || 1));
      }
    }
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'historical_msrp',
      spec_value: basePrice,
      raw_data: {
        base_msrp_2024_eur: basePrice,
        historical_msrp: historicalPrices,
        price_trend: 'increasing',
        inflation_adjusted: true,
        currency: 'EUR',
        market: 'France',
      },
    });
    
    // 7. TRIM LEVELS
    const trims = TRIM_LEVELS[brandName] || TRIM_LEVELS['default'];
    const trimData = trims.map(t => ({
      name: t.name,
      price_eur: Math.round(basePrice * t.price_mult),
      price_increment_eur: Math.round(basePrice * (t.price_mult - 1)),
      standard_features: t.features,
    }));
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'trim_levels',
      spec_value: trims.length,
      raw_data: {
        available_trims: trimData,
        recommended_trim: trims[1]?.name || 'Mid',
        best_value_trim: trims[1]?.name || 'Mid',
        most_popular_trim: trims[Math.floor(trims.length / 2)]?.name || 'Mid',
      },
    });
    
    // 8. CRASH TEST DETAILED
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'crash_test_detailed',
      spec_value: 5,
      raw_data: {
        test_protocols: CRASH_TEST_DETAILS,
        frontal_offset_score_pct: randInt(85, 98),
        full_width_score_pct: randInt(80, 95),
        side_impact_score_pct: randInt(85, 98),
        side_pole_score_pct: randInt(80, 95),
        whiplash_score: rand(3.5, 4.8),
        pedestrian_score_pct: randInt(60, 85),
        cyclist_score_pct: randInt(55, 80),
        aeb_car_score_pct: randInt(75, 100),
        aeb_pedestrian_score_pct: randInt(70, 95),
        aeb_cyclist_score_pct: randInt(65, 90),
        speed_assist_score_pct: randInt(70, 100),
        lane_assist_score_pct: randInt(75, 100),
        airbag_count: isPremium ? randInt(8, 12) : randInt(6, 8),
        curtain_airbags: true,
        knee_airbags: isPremium,
        center_airbag: prodYear >= 2021 && isPremium,
        far_side_airbags: prodYear >= 2022 && isPremium,
      },
    });
    
    // 9. TRACK PERFORMANCE (Nürburgring estimate)
    const ringTime = NURBURGRING_ESTIMATES[perfLevel] || NURBURGRING_ESTIMATES['standard'];
    const lapTimeSec = randInt(ringTime[0], ringTime[1]);
    const minutes = Math.floor(lapTimeSec / 60);
    const seconds = lapTimeSec % 60;
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'track_performance',
      spec_value: lapTimeSec,
      raw_data: {
        nurburgring_nordschleife_sec: lapTimeSec,
        nurburgring_nordschleife_formatted: `${minutes}:${seconds.toString().padStart(2, '0')}`,
        performance_level: perfLevel,
        hockenheim_gp_sec: randInt(100, 140),
        spa_francorchamps_sec: randInt(160, 220),
        skidpad_g: rand(0.85, 1.15),
        slalom_kmh: randInt(62, 78),
        track_mode_available: perfLevel === 'performance' || perfLevel === 'supercar',
        lap_timer_built_in: isPremium,
        telemetry_logging: perfLevel === 'supercar' || (isPremium && segment === 'sports'),
      },
    });
    
    // 10. LIGHTING SPECIFICATIONS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'lighting_specs',
      spec_value: 0,
      raw_data: {
        headlight_type: prodYear >= 2022 ? (isPremium ? 'Matrix LED' : 'LED') : (isPremium ? 'LED' : 'Halogen'),
        high_beam_type: isPremium && prodYear >= 2020 ? 'Adaptive Matrix' : 'LED',
        drl_type: 'LED',
        drl_signature: brandName,
        fog_lights: segment !== 'electric',
        cornering_lights: isPremium,
        welcome_lights: isPremium,
        ambient_interior_colors: isPremium ? randInt(32, 128) : (prodYear >= 2020 ? randInt(8, 16) : 0),
        taillight_type: prodYear >= 2020 ? 'LED' : 'LED/Incandescent',
        dynamic_turn_signals: isPremium && prodYear >= 2018,
        laser_headlights: isPremium && segment === 'luxury' && brandName === 'BMW',
        oled_taillights: isPremium && segment === 'sports' && prodYear >= 2022,
        light_range_m: isPremium ? randInt(500, 650) : randInt(300, 450),
        auto_high_beam: prodYear >= 2018,
      },
    });
  }
  
  // Batch insert
  console.log(`\n💀 Inserting ${allSpecs.length} void-level specs...\n`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < allSpecs.length; i += batchSize) {
    const batch = allSpecs.slice(i, i + batchSize);
    const { error } = await supabase
      .from('third_party_specs')
      .upsert(batch, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) {
      inserted += batch.length;
      process.stdout.write(`\r   ⚫ ${inserted} / ${allSpecs.length}`);
    }
  }
  
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🕳️  HEAT DEATH COMPLETE - NOTHING REMAINS');
  console.log('═'.repeat(60));
  console.log(`   New specs: ${inserted}`);
  console.log(`   Total third_party_specs: ${count}`);
  console.log(`\n   Final excavation:`);
  console.log(`   • Suspension geometry (camber, caster, toe, spring rates)`);
  console.log(`   • Aerodynamics (Cd, frontal area, SCx)`);
  console.log(`   • Brake specifications (disc sizes, caliper pistons)`);
  console.log(`   • Steering specifications (ratio, turns lock-to-lock)`);
  console.log(`   • Weight distribution (front/rear %)`);
  console.log(`   • Historical MSRP (2015-2025)`);
  console.log(`   • Trim levels with pricing`);
  console.log(`   • Crash test detailed (all Euro NCAP protocols)`);
  console.log(`   • Track performance (Nürburgring estimates)`);
  console.log(`   • Lighting specifications (matrix LED, OLED, laser)`);
}

heatDeath().catch(console.error);
