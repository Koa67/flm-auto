/**
 * FLM AUTO - MARIANA TRENCH 🌊
 * 
 * Phase 5: Glass specs, Seat specs, Climate control, Storage,
 * Towing, Electrical system, Build quality, User reviews synthesis,
 * Resale factors, Insurance risk factors, Theft stats
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// GLASS & VISIBILITY
// ============================================================
const GLASS_SPECS: Record<string, any> = {
  compact: { windshield_area_m2: [0.9, 1.1], rear_window_m2: [0.5, 0.7], a_pillar_angle: [28, 35] },
  sedan: { windshield_area_m2: [1.0, 1.3], rear_window_m2: [0.6, 0.8], a_pillar_angle: [30, 38] },
  suv: { windshield_area_m2: [1.1, 1.4], rear_window_m2: [0.7, 0.9], a_pillar_angle: [32, 40] },
  sports: { windshield_area_m2: [0.8, 1.0], rear_window_m2: [0.3, 0.5], a_pillar_angle: [25, 32] },
  luxury: { windshield_area_m2: [1.1, 1.4], rear_window_m2: [0.6, 0.8], a_pillar_angle: [28, 35] },
  electric: { windshield_area_m2: [1.0, 1.3], rear_window_m2: [0.5, 0.7], a_pillar_angle: [28, 36] },
};

// SEAT SPECIFICATIONS
const SEAT_SPECS: Record<string, any> = {
  compact: { 
    front_travel_mm: [220, 260], front_recline_deg: [55, 65], cushion_length_mm: [480, 520],
    rear_recline: false, lumbar_support: 'manual', bolster_adjustable: false,
  },
  sedan: {
    front_travel_mm: [250, 300], front_recline_deg: [60, 70], cushion_length_mm: [500, 550],
    rear_recline: true, lumbar_support: 'power', bolster_adjustable: false,
  },
  suv: {
    front_travel_mm: [260, 310], front_recline_deg: [60, 70], cushion_length_mm: [510, 560],
    rear_recline: true, lumbar_support: 'power', bolster_adjustable: false,
  },
  sports: {
    front_travel_mm: [220, 270], front_recline_deg: [50, 60], cushion_length_mm: [490, 530],
    rear_recline: false, lumbar_support: 'power', bolster_adjustable: true,
  },
  luxury: {
    front_travel_mm: [280, 330], front_recline_deg: [65, 80], cushion_length_mm: [520, 580],
    rear_recline: true, lumbar_support: 'power_4way', bolster_adjustable: true,
  },
  electric: {
    front_travel_mm: [260, 310], front_recline_deg: [60, 75], cushion_length_mm: [500, 550],
    rear_recline: true, lumbar_support: 'power', bolster_adjustable: false,
  },
};

// STORAGE COMPARTMENTS
const STORAGE_LOCATIONS = [
  'glovebox', 'center_console', 'door_pockets_front', 'door_pockets_rear',
  'seatback_pockets', 'under_seat_front', 'armrest_storage', 'cup_holders_front',
  'cup_holders_rear', 'sunglasses_holder', 'card_holder', 'phone_tray',
  'wireless_charging_pad', 'umbrella_holder', 'trunk_underfloor', 'trunk_side_nets',
  'roof_console', 'third_row_storage', 'frunk',
];

// CLIMATE SPECS
const CLIMATE_SPECS: Record<string, any> = {
  basic: { zones: 1, vents: 6, filter: 'particle', auto: true, rear_vents: false },
  standard: { zones: 2, vents: 8, filter: 'particle', auto: true, rear_vents: true },
  premium: { zones: 3, vents: 12, filter: 'activated_carbon', auto: true, rear_vents: true },
  luxury: { zones: 4, vents: 16, filter: 'HEPA', auto: true, rear_vents: true },
};

// TOWING SPECS
const TOWING_SPECS: Record<string, any> = {
  compact: { braked: [1200, 1600], unbraked: [600, 750], tongue: [60, 75], towbar: 'optional' },
  sedan: { braked: [1600, 2100], unbraked: [700, 750], tongue: [75, 85], towbar: 'optional' },
  suv: { braked: [2200, 3500], unbraked: [750, 750], tongue: [85, 150], towbar: 'optional' },
  sports: { braked: [0, 0], unbraked: [0, 0], tongue: [0, 0], towbar: 'not_available' },
  luxury: { braked: [2000, 2500], unbraked: [750, 750], tongue: [80, 100], towbar: 'optional' },
  electric: { braked: [1000, 2500], unbraked: [750, 750], tongue: [75, 100], towbar: 'optional' },
};

// ELECTRICAL SYSTEM
const ELECTRICAL_SPECS: Record<string, any> = {
  standard: { voltage: 12, battery_ah: [60, 80], alternator_a: [140, 180], fuse_count: [35, 45] },
  premium: { voltage: 12, battery_ah: [80, 105], alternator_a: [180, 250], fuse_count: [50, 70] },
  mild_hybrid: { voltage: 48, battery_ah: [10, 15], alternator_a: [0, 0], fuse_count: [55, 75] },
  electric: { voltage: 400, battery_ah: [0, 0], alternator_a: [0, 0], fuse_count: [60, 90] },
  electric_800v: { voltage: 800, battery_ah: [0, 0], alternator_a: [0, 0], fuse_count: [70, 100] },
};

// BUILD QUALITY METRICS
const BUILD_QUALITY: Record<string, any> = {
  'BMW': { panel_gaps_mm: [3.5, 4.5], paint_microns: [120, 140], interior_materials: 9, squeak_rattle: 8 },
  'Mercedes-Benz': { panel_gaps_mm: [3.0, 4.0], paint_microns: [130, 150], interior_materials: 9, squeak_rattle: 8 },
  'Audi': { panel_gaps_mm: [3.0, 4.0], paint_microns: [125, 145], interior_materials: 9, squeak_rattle: 9 },
  'Porsche': { panel_gaps_mm: [2.5, 3.5], paint_microns: [140, 170], interior_materials: 10, squeak_rattle: 9 },
  'Volkswagen': { panel_gaps_mm: [4.0, 5.0], paint_microns: [100, 120], interior_materials: 7, squeak_rattle: 7 },
  'Tesla': { panel_gaps_mm: [4.5, 7.0], paint_microns: [90, 120], interior_materials: 7, squeak_rattle: 6 },
  'Skoda': { panel_gaps_mm: [4.0, 5.5], paint_microns: [95, 115], interior_materials: 7, squeak_rattle: 7 },
  'Hyundai': { panel_gaps_mm: [3.5, 5.0], paint_microns: [100, 125], interior_materials: 8, squeak_rattle: 8 },
  'Volvo': { panel_gaps_mm: [3.5, 4.5], paint_microns: [115, 135], interior_materials: 9, squeak_rattle: 8 },
  'Toyota': { panel_gaps_mm: [3.5, 4.5], paint_microns: [105, 125], interior_materials: 7, squeak_rattle: 9 },
  'default': { panel_gaps_mm: [4.0, 5.5], paint_microns: [95, 120], interior_materials: 7, squeak_rattle: 7 },
};

// USER REVIEW SYNTHESIS
const REVIEW_TOPICS = [
  'ride_comfort', 'handling', 'steering_feel', 'braking', 'acceleration',
  'fuel_economy', 'interior_quality', 'seat_comfort', 'visibility', 'storage_space',
  'infotainment', 'audio_quality', 'climate_control', 'noise_levels', 'reliability',
  'dealer_service', 'value_for_money', 'resale_value', 'running_costs', 'practicality',
];

// THEFT STATISTICS (vehicles per 1000)
const THEFT_RATES: Record<string, number> = {
  'BMW': 6.2, 'Mercedes-Benz': 5.8, 'Audi': 5.1, 'Volkswagen': 3.2,
  'Porsche': 2.1, 'Tesla': 0.8, 'Skoda': 2.8, 'Hyundai': 4.5,
  'Volvo': 1.9, 'Toyota': 3.8, 'Kia': 5.2, 'default': 3.5,
};

// INSURANCE RISK FACTORS
const INSURANCE_FACTORS = {
  performance: { low: 1.0, medium: 1.15, high: 1.35, very_high: 1.6 },
  theft_risk: { low: 1.0, medium: 1.1, high: 1.25, very_high: 1.4 },
  repair_cost: { low: 1.0, medium: 1.15, high: 1.3, very_high: 1.5 },
  safety_rating: { excellent: 0.9, good: 1.0, average: 1.1, poor: 1.25 },
};

// RESALE FACTORS
const RESALE_FACTORS = [
  'mileage', 'service_history', 'accident_history', 'owner_count', 'color',
  'options', 'condition', 'market_demand', 'fuel_type_trend', 'emission_regulations',
  'brand_perception', 'model_popularity', 'successor_model', 'production_numbers',
];

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

async function marianaTrench() {
  console.log('🌊 MARIANA TRENCH - DEEPEST POINT REACHED\n');
  console.log('═'.repeat(60));
  
  const { data: generations } = await supabase
    .from('generations')
    .select(`
      id, name, production_start,
      model:models(id, name, brand:brands(id, name))
    `);
  
  if (!generations) return;
  
  console.log(`\n🦑 Processing ${generations.length} generations...\n`);
  
  const allSpecs: any[] = [];
  
  for (const gen of generations) {
    const model = (gen.model as any);
    if (!model?.brand) continue;
    
    const brandName = model.brand.name;
    const modelName = model.name;
    const segment = getSegment(modelName);
    const isPremium = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Volvo', 'Tesla'].includes(brandName);
    const prodYear = gen.production_start || 2020;
    const isElectric = segment === 'electric';
    
    const glass = GLASS_SPECS[segment] || GLASS_SPECS['sedan'];
    const seats = SEAT_SPECS[segment] || SEAT_SPECS['sedan'];
    const towing = TOWING_SPECS[segment] || TOWING_SPECS['sedan'];
    const buildQuality = BUILD_QUALITY[brandName] || BUILD_QUALITY['default'];
    
    // 1. GLASS & VISIBILITY
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'glass_visibility',
      spec_value: 0,
      raw_data: {
        windshield_area_m2: rand(glass.windshield_area_m2[0], glass.windshield_area_m2[1]),
        rear_window_area_m2: rand(glass.rear_window_m2[0], glass.rear_window_m2[1]),
        side_window_area_m2: rand(0.8, 1.2),
        total_glass_area_m2: rand(3.5, 5.5),
        a_pillar_angle_deg: randInt(glass.a_pillar_angle[0], glass.a_pillar_angle[1]),
        a_pillar_obstruction: randInt(glass.a_pillar_angle[0], glass.a_pillar_angle[1]) > 33 ? 'high' : 'moderate',
        rear_visibility_rating: segment === 'suv' ? 'good' : (segment === 'sports' ? 'limited' : 'good'),
        blind_spot_size: isPremium ? 'small' : 'moderate',
        windshield_rake_deg: randInt(28, 38),
        uv_protection: isPremium ? 'full_spectrum' : 'standard',
        acoustic_glass: isPremium,
        heated_windshield: isPremium && brandName !== 'Tesla',
        heated_washer_jets: prodYear >= 2018,
        rain_sensing_wipers: prodYear >= 2016,
        heads_up_display_compatible: isPremium,
        privacy_glass_rear: true,
        sunroof_area_m2: isPremium ? rand(0.4, 1.2) : 0,
        panoramic_roof: isPremium && Math.random() > 0.4,
      },
    });
    
    // 2. SEAT SPECIFICATIONS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'seat_specifications',
      spec_value: 0,
      raw_data: {
        seating_capacity: segment === 'sports' ? (Math.random() > 0.5 ? 2 : 4) : 5,
        front_seat_type: isPremium ? 'sport' : 'comfort',
        front_travel_mm: randInt(seats.front_travel_mm[0], seats.front_travel_mm[1]),
        front_recline_range_deg: randInt(seats.front_recline_deg[0], seats.front_recline_deg[1]),
        front_height_adjust_mm: randInt(50, 80),
        front_tilt_adjust: isPremium,
        front_cushion_length_mm: randInt(seats.cushion_length_mm[0], seats.cushion_length_mm[1]),
        front_cushion_extension: isPremium,
        lumbar_support: seats.lumbar_support,
        lumbar_ways: isPremium ? 4 : 2,
        bolster_adjustable: seats.bolster_adjustable,
        memory_positions: isPremium ? randInt(2, 3) : 0,
        power_adjustments_front: isPremium ? randInt(12, 22) : (prodYear >= 2018 ? randInt(6, 10) : 0),
        heated_front: prodYear >= 2016 || isPremium,
        heated_rear: isPremium,
        ventilated_front: isPremium,
        ventilated_rear: isPremium && segment === 'luxury',
        massage_front: isPremium && segment === 'luxury',
        massage_rear: segment === 'luxury',
        rear_recline: seats.rear_recline,
        rear_slide: segment === 'suv',
        rear_split: '40/20/40',
        rear_fold_flat: segment !== 'sports',
        third_row_available: segment === 'suv' && Math.random() > 0.6,
        seat_material_standard: isPremium ? 'leather' : 'cloth',
        seat_material_options: ['cloth', 'leatherette', 'leather', 'nappa_leather', 'alcantara'],
      },
    });
    
    // 3. STORAGE COMPARTMENTS
    const availableStorage = STORAGE_LOCATIONS.filter(() => Math.random() > 0.3);
    if (isElectric) availableStorage.push('frunk');
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'storage_compartments',
      spec_value: availableStorage.length,
      raw_data: {
        compartment_count: availableStorage.length,
        compartments: availableStorage,
        glovebox_volume_l: rand(6, 12),
        center_console_volume_l: rand(4, 10),
        door_pocket_volume_l: rand(1.5, 3),
        armrest_volume_l: rand(3, 8),
        cup_holders_total: randInt(4, 8),
        bottle_holders: randInt(4, 8),
        bag_hooks: randInt(2, 6),
        'outlets_12v': randInt(1, 3),
        usb_ports: randInt(2, 6),
        usb_c_ports: prodYear >= 2020 ? randInt(1, 4) : 0,
        wireless_charging_watts: prodYear >= 2019 && isPremium ? 15 : 0,
        frunk_volume_l: isElectric ? randInt(30, 80) : 0,
        under_floor_storage_l: randInt(20, 50),
        ski_hatch: segment !== 'sports',
        load_through_width_mm: randInt(900, 1200),
        load_lip_height_mm: randInt(650, 800),
        powered_tailgate: isPremium,
        hands_free_tailgate: isPremium && prodYear >= 2018,
      },
    });
    
    // 4. CLIMATE CONTROL
    const climateLevel = segment === 'luxury' ? 'luxury' : (isPremium ? 'premium' : (prodYear >= 2018 ? 'standard' : 'basic'));
    const climate = CLIMATE_SPECS[climateLevel];
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'climate_control',
      spec_value: climate.zones,
      raw_data: {
        climate_zones: climate.zones,
        vent_count: climate.vents,
        filter_type: climate.filter,
        automatic: climate.auto,
        rear_vents: climate.rear_vents,
        rear_controls: climate.zones >= 3,
        heated_steering_wheel: isPremium || prodYear >= 2020,
        heated_windshield: isPremium && brandName !== 'Tesla',
        windshield_defrost_time_sec: randInt(60, 180),
        cabin_preheat: isElectric || (isPremium && prodYear >= 2018),
        cabin_precool: isElectric || (isPremium && prodYear >= 2020),
        air_quality_sensor: isPremium,
        fragrance_system: brandName === 'Mercedes-Benz' && segment === 'luxury',
        ionizer: isPremium && prodYear >= 2020,
        humidity_control: segment === 'luxury',
        sun_position_compensation: isPremium,
        co2_sensor: prodYear >= 2022,
        recirculation_auto: true,
        ac_compressor_type: isElectric ? 'electric' : 'belt_driven',
        refrigerant: prodYear >= 2022 ? 'R1234yf' : 'R134a',
        cooling_capacity_kw: rand(5, 10),
        heating_capacity_kw: isElectric ? rand(5, 8) : rand(8, 15),
        heat_pump: isElectric,
      },
    });
    
    // 5. TOWING SPECIFICATIONS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'towing_specifications',
      spec_value: towing.braked[1],
      raw_data: {
        max_towing_braked_kg: randInt(towing.braked[0], towing.braked[1]),
        max_towing_unbraked_kg: towing.unbraked[1] > 0 ? randInt(towing.unbraked[0], towing.unbraked[1]) : 0,
        max_tongue_weight_kg: towing.tongue[1] > 0 ? randInt(towing.tongue[0], towing.tongue[1]) : 0,
        towbar_availability: towing.towbar,
        towbar_type: towing.towbar !== 'not_available' ? (isPremium ? 'retractable_electric' : 'detachable') : null,
        trailer_stability_assist: towing.braked[1] > 1500,
        trailer_sway_control: towing.braked[1] > 2000,
        trailer_camera: isPremium && segment === 'suv',
        trailer_assist: isPremium && segment === 'suv' && prodYear >= 2018,
        max_roof_load_kg: segment === 'sports' ? 0 : randInt(75, 100),
        roof_rails: segment === 'suv',
        roof_bars_load_dynamic_kg: randInt(50, 75),
        roof_box_compatible: segment !== 'sports',
      },
    });
    
    // 6. ELECTRICAL SYSTEM
    const elecType = isElectric ? (brandName === 'Porsche' || brandName === 'Hyundai' ? 'electric_800v' : 'electric') : (isPremium && prodYear >= 2020 ? 'mild_hybrid' : (isPremium ? 'premium' : 'standard'));
    const elec = ELECTRICAL_SPECS[elecType];
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'electrical_system',
      spec_value: elec.voltage,
      raw_data: {
        system_voltage: elec.voltage,
        battery_12v_ah: elec.battery_ah[1] > 0 ? randInt(elec.battery_ah[0], elec.battery_ah[1]) : 'lithium_auxiliary',
        battery_12v_type: prodYear >= 2020 ? 'AGM' : 'lead_acid',
        alternator_output_a: elec.alternator_a[1] > 0 ? randInt(elec.alternator_a[0], elec.alternator_a[1]) : null,
        fuse_box_count: 2,
        fuse_total: randInt(elec.fuse_count[0], elec.fuse_count[1]),
        obd_port_location: 'under_dash_left',
        can_bus_speed_kbps: prodYear >= 2020 ? 500 : 250,
        ethernet_backbone: isElectric || (isPremium && prodYear >= 2022),
        ota_update_capable: isElectric || (isPremium && prodYear >= 2020),
        ota_scope: isElectric ? 'full_vehicle' : (isPremium ? 'infotainment_only' : 'none'),
        keyless_entry: prodYear >= 2016,
        keyless_start: prodYear >= 2016,
        key_type: prodYear >= 2020 ? 'digital_key' : 'smart_key',
        phone_as_key: isElectric || (isPremium && prodYear >= 2020),
        remote_start: isPremium,
        remote_climate: isElectric || (isPremium && prodYear >= 2018),
      },
    });
    
    // 7. BUILD QUALITY METRICS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'build_quality',
      spec_value: 0,
      raw_data: {
        panel_gap_avg_mm: rand(buildQuality.panel_gaps_mm[0], buildQuality.panel_gaps_mm[1]),
        panel_gap_consistency: buildQuality.panel_gaps_mm[1] < 4 ? 'excellent' : (buildQuality.panel_gaps_mm[1] < 5 ? 'good' : 'average'),
        paint_thickness_microns: randInt(buildQuality.paint_microns[0], buildQuality.paint_microns[1]),
        paint_quality_rating: buildQuality.paint_microns[1] > 130 ? 'excellent' : (buildQuality.paint_microns[1] > 115 ? 'good' : 'average'),
        interior_materials_rating: buildQuality.interior_materials,
        soft_touch_surfaces_pct: isPremium ? randInt(70, 95) : randInt(40, 65),
        squeak_rattle_rating: buildQuality.squeak_rattle,
        shut_line_consistency: isPremium ? 'excellent' : 'good',
        door_closing_effort: isPremium ? 'luxury_thunk' : 'solid',
        manufacturing_plant: brandName === 'BMW' ? 'Germany/South Africa/China' : (brandName === 'Tesla' ? 'USA/China/Germany' : 'Germany/Slovakia/Mexico'),
        quality_certifications: ['ISO 9001', 'IATF 16949'],
      },
    });
    
    // 8. USER REVIEW SYNTHESIS
    const reviewScores: Record<string, number> = {};
    for (const topic of REVIEW_TOPICS) {
      reviewScores[topic] = rand(3.0, 5.0);
    }
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'user_reviews_synthesis',
      spec_value: 0,
      raw_data: {
        overall_rating: rand(3.5, 4.8),
        review_count: randInt(50, 2000),
        topic_scores: reviewScores,
        common_praise: isPremium ? ['build_quality', 'driving_dynamics', 'technology'] : ['value', 'practicality', 'reliability'],
        common_complaints: brandName === 'Tesla' ? ['panel_gaps', 'service_network', 'parts_availability'] : ['infotainment_complexity', 'running_costs', 'options_pricing'],
        would_recommend_pct: randInt(70, 95),
        owner_loyalty_pct: randInt(40, 80),
        sentiment_trend: 'stable',
      },
    });
    
    // 9. THEFT & SECURITY
    const theftRate = THEFT_RATES[brandName] || THEFT_RATES['default'];
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'theft_security',
      spec_value: 0,
      raw_data: {
        theft_rate_per_1000: theftRate * (1 + (Math.random() - 0.5) * 0.4),
        theft_risk_category: theftRate > 5 ? 'high' : (theftRate > 3 ? 'medium' : 'low'),
        most_stolen_in_segment: theftRate > 5,
        recovery_rate_pct: randInt(40, 75),
        avg_time_to_steal_min: randInt(2, 15),
        common_theft_methods: ['relay_attack', 'obd_port', 'key_cloning'],
        immobilizer_type: prodYear >= 2020 ? 'ultra_high_frequency' : 'standard',
        alarm_standard: true,
        perimeter_alarm: isPremium,
        interior_motion_sensor: isPremium,
        tilt_sensor: isPremium,
        tracking_system: isPremium ? 'built_in' : 'optional',
        geofencing: isElectric || (isPremium && prodYear >= 2020),
        remote_disable: isElectric,
        thatcham_category: randInt(1, 5),
        insurance_group_theft_impact: theftRate > 5 ? '+3' : (theftRate > 3 ? '+1' : '0'),
      },
    });
    
    // 10. INSURANCE RISK FACTORS
    const perfRisk = segment === 'sports' ? 'very_high' : (segment === 'luxury' ? 'high' : (isPremium ? 'medium' : 'low'));
    const theftRisk = theftRate > 5 ? 'high' : (theftRate > 3 ? 'medium' : 'low');
    const repairRisk = isPremium ? 'high' : 'medium';
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'insurance_risk_factors',
      spec_value: 0,
      raw_data: {
        performance_risk: perfRisk,
        performance_multiplier: INSURANCE_FACTORS.performance[perfRisk as keyof typeof INSURANCE_FACTORS.performance],
        theft_risk: theftRisk,
        theft_multiplier: INSURANCE_FACTORS.theft_risk[theftRisk as keyof typeof INSURANCE_FACTORS.theft_risk],
        repair_cost_risk: repairRisk,
        repair_multiplier: INSURANCE_FACTORS.repair_cost[repairRisk as keyof typeof INSURANCE_FACTORS.repair_cost],
        safety_rating: 'good',
        safety_multiplier: INSURANCE_FACTORS.safety_rating['good'],
        combined_risk_score: rand(0.8, 1.5),
        insurance_group_estimate: randInt(15, 50),
        young_driver_surcharge_pct: segment === 'sports' ? randInt(80, 150) : randInt(20, 60),
        typical_annual_premium_30yo_eur: randInt(600, 2500),
        typical_annual_premium_25yo_eur: randInt(900, 4000),
        claim_frequency: rand(0.05, 0.15),
        avg_claim_cost_eur: randInt(2000, 15000),
      },
    });
    
    // 11. RESALE VALUE FACTORS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'resale_factors',
      spec_value: 0,
      raw_data: {
        key_factors: RESALE_FACTORS,
        mileage_impact_per_10k_km_pct: -2.5,
        color_premium_white_pct: 2,
        color_premium_black_pct: 1,
        color_discount_unusual_pct: -5,
        full_service_history_premium_pct: 8,
        accident_history_discount_pct: -15,
        single_owner_premium_pct: 5,
        options_value_retention_pct: 40,
        market_demand: isPremium ? 'high' : 'medium',
        fuel_type_trend: isElectric ? 'increasing' : 'stable',
        emission_regulation_risk: !isElectric && prodYear < 2020 ? 'high' : 'low',
        brand_perception_score: isPremium ? randInt(75, 95) : randInt(55, 75),
        model_popularity_score: randInt(50, 95),
        expected_production_years: randInt(5, 8),
        limited_edition: Math.random() > 0.95,
        collector_potential: segment === 'sports' && Math.random() > 0.8,
      },
    });
    
    // 12. CONNECTIVITY & APPS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'connectivity_apps',
      spec_value: 0,
      raw_data: {
        connected_services_brand: `${brandName} Connected`,
        mobile_app_rating: rand(3.0, 4.5),
        app_features: ['remote_lock', 'remote_climate', 'location', 'trip_history', 'maintenance_alerts'],
        subscription_required: isPremium,
        subscription_cost_annual_eur: isPremium ? randInt(100, 300) : 0,
        free_trial_years: isPremium ? randInt(1, 3) : 0,
        real_time_traffic: true,
        online_routing: true,
        poi_search: true,
        voice_assistant: prodYear >= 2020 ? (brandName === 'Mercedes-Benz' ? 'MBUX' : (brandName === 'BMW' ? 'BMW Intelligent Personal Assistant' : 'native')) : 'basic',
        alexa_integration: prodYear >= 2020,
        google_assistant: prodYear >= 2021,
        siri_shortcuts: prodYear >= 2019,
        smart_home_integration: isPremium && prodYear >= 2020,
        calendar_integration: true,
        concierge_service: isPremium && segment === 'luxury',
        data_plan_included_gb: isElectric ? 'unlimited' : (isPremium ? '10' : '3'),
        wifi_hotspot: isPremium,
        wifi_hotspot_devices: isPremium ? randInt(8, 10) : 0,
      },
    });
  }
  
  // Batch insert
  console.log(`\n🦑 Inserting ${allSpecs.length} deep-sea specs...\n`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < allSpecs.length; i += batchSize) {
    const batch = allSpecs.slice(i, i + batchSize);
    const { error } = await supabase
      .from('third_party_specs')
      .upsert(batch, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) {
      inserted += batch.length;
      process.stdout.write(`\r   🌊 ${inserted} / ${allSpecs.length}`);
    }
  }
  
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🌊 MARIANA TRENCH - WE\'VE HIT BEDROCK');
  console.log('═'.repeat(60));
  console.log(`   New specs: ${inserted}`);
  console.log(`   Total third_party_specs: ${count}`);
  console.log(`\n   Abyssal data:`);
  console.log(`   • Glass & visibility (windshield area, A-pillar angle)`);
  console.log(`   • Seat specifications (22-way adjust, massage, ventilation)`);
  console.log(`   • Storage compartments (every cubby counted)`);
  console.log(`   • Climate control (zones, filters, fragrance)`);
  console.log(`   • Towing specifications (braked, unbraked, tongue weight)`);
  console.log(`   • Electrical system (voltage, CAN bus, OTA)`);
  console.log(`   • Build quality metrics (panel gaps, paint thickness)`);
  console.log(`   • User review synthesis (20 topic scores)`);
  console.log(`   • Theft & security (rates, methods, recovery)`);
  console.log(`   • Insurance risk factors (multipliers, premiums)`);
  console.log(`   • Resale value factors (14 key factors)`);
  console.log(`   • Connectivity & apps (subscriptions, integrations)`);
}

marianaTrench().catch(console.error);
