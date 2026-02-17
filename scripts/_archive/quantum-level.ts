/**
 * FLM AUTO - QUANTUM LEVEL 🔬
 * 
 * Phase 7: EVERY. SINGLE. DETAIL.
 * Fuses, Bulbs, Belts, Filters, Bearings, Fasteners,
 * Assembly worker metadata, Tool specifications,
 * Molecular composition of materials, Paint layer thickness per coat
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// FUSE BOX SPECIFICATIONS
// ============================================================
const FUSE_LOCATIONS = ['engine_bay', 'driver_footwell', 'passenger_footwell', 'trunk', 'rear_seat'];
const FUSE_TYPES = ['mini', 'standard', 'maxi', 'cartridge', 'slow_blow'];
const FUSE_FUNCTIONS = [
  { name: 'headlights_low', amp: 15, type: 'mini' },
  { name: 'headlights_high', amp: 20, type: 'mini' },
  { name: 'fog_lights', amp: 15, type: 'mini' },
  { name: 'horn', amp: 15, type: 'mini' },
  { name: 'wipers_front', amp: 25, type: 'mini' },
  { name: 'wiper_rear', amp: 15, type: 'mini' },
  { name: 'power_windows_driver', amp: 25, type: 'mini' },
  { name: 'power_windows_passenger', amp: 25, type: 'mini' },
  { name: 'power_windows_rear', amp: 20, type: 'mini' },
  { name: 'sunroof', amp: 20, type: 'mini' },
  { name: 'central_locking', amp: 20, type: 'mini' },
  { name: 'interior_lights', amp: 10, type: 'mini' },
  { name: 'cigarette_lighter', amp: 20, type: 'standard' },
  { name: 'aux_power_outlet', amp: 20, type: 'standard' },
  { name: 'radio_infotainment', amp: 20, type: 'mini' },
  { name: 'amplifier', amp: 30, type: 'standard' },
  { name: 'heated_seats_driver', amp: 15, type: 'mini' },
  { name: 'heated_seats_passenger', amp: 15, type: 'mini' },
  { name: 'heated_steering', amp: 15, type: 'mini' },
  { name: 'heated_mirrors', amp: 10, type: 'mini' },
  { name: 'abs_module', amp: 40, type: 'maxi' },
  { name: 'esp_module', amp: 40, type: 'maxi' },
  { name: 'engine_ecu', amp: 15, type: 'mini' },
  { name: 'transmission_ecu', amp: 10, type: 'mini' },
  { name: 'fuel_pump', amp: 20, type: 'mini' },
  { name: 'ignition_coils', amp: 15, type: 'mini' },
  { name: 'starter_relay', amp: 50, type: 'maxi' },
  { name: 'alternator', amp: 80, type: 'cartridge' },
  { name: 'ac_compressor', amp: 10, type: 'mini' },
  { name: 'ac_blower', amp: 40, type: 'maxi' },
  { name: 'cooling_fan_1', amp: 40, type: 'maxi' },
  { name: 'cooling_fan_2', amp: 40, type: 'maxi' },
  { name: 'abs_pump', amp: 60, type: 'cartridge' },
  { name: 'electric_power_steering', amp: 80, type: 'cartridge' },
  { name: 'trailer_socket', amp: 30, type: 'standard' },
  { name: 'rear_wiper', amp: 15, type: 'mini' },
  { name: 'reverse_lights', amp: 10, type: 'mini' },
  { name: 'brake_lights', amp: 15, type: 'mini' },
  { name: 'turn_signals', amp: 15, type: 'mini' },
  { name: 'instrument_cluster', amp: 10, type: 'mini' },
  { name: 'airbag_module', amp: 10, type: 'mini' },
  { name: 'parking_sensors', amp: 10, type: 'mini' },
  { name: 'rearview_camera', amp: 10, type: 'mini' },
  { name: 'keyless_entry', amp: 10, type: 'mini' },
  { name: 'obd_port', amp: 10, type: 'mini' },
];

// BULB SPECIFICATIONS
const BULB_SPECS = [
  { location: 'headlight_low_beam', type: 'LED', wattage: 25, socket: 'H7', kelvin: 6000 },
  { location: 'headlight_high_beam', type: 'LED', wattage: 30, socket: 'H1', kelvin: 6000 },
  { location: 'headlight_drl', type: 'LED', wattage: 6, socket: 'W21W', kelvin: 6500 },
  { location: 'fog_light_front', type: 'LED', wattage: 15, socket: 'H11', kelvin: 3000 },
  { location: 'turn_signal_front', type: 'LED', wattage: 5, socket: 'PY21W', kelvin: 2700 },
  { location: 'turn_signal_side', type: 'LED', wattage: 3, socket: 'W5W', kelvin: 2700 },
  { location: 'turn_signal_rear', type: 'LED', wattage: 5, socket: 'PY21W', kelvin: 2700 },
  { location: 'tail_light', type: 'LED', wattage: 4, socket: 'W21W', kelvin: 'red' },
  { location: 'brake_light', type: 'LED', wattage: 6, socket: 'P21W', kelvin: 'red' },
  { location: 'brake_light_high', type: 'LED', wattage: 5, socket: 'W16W', kelvin: 'red' },
  { location: 'reverse_light', type: 'LED', wattage: 10, socket: 'W16W', kelvin: 6000 },
  { location: 'license_plate', type: 'LED', wattage: 3, socket: 'W5W', kelvin: 6000 },
  { location: 'interior_dome', type: 'LED', wattage: 5, socket: 'C5W_36mm', kelvin: 5000 },
  { location: 'interior_map', type: 'LED', wattage: 3, socket: 'W5W', kelvin: 5000 },
  { location: 'interior_footwell', type: 'LED', wattage: 2, socket: 'W5W', kelvin: 'ambient' },
  { location: 'glove_box', type: 'LED', wattage: 2, socket: 'W5W', kelvin: 5000 },
  { location: 'trunk', type: 'LED', wattage: 5, socket: 'C5W_41mm', kelvin: 5000 },
  { location: 'vanity_mirror', type: 'LED', wattage: 2, socket: 'T4W', kelvin: 5000 },
  { location: 'door_courtesy', type: 'LED', wattage: 2, socket: 'W5W', kelvin: 5000 },
  { location: 'puddle_light', type: 'LED', wattage: 3, socket: 'W5W', kelvin: 6000 },
];

// BELT SPECIFICATIONS
const BELT_SPECS = {
  serpentine: { length_mm: [1750, 2100], ribs: [6, 7], width_mm: [21, 25], brand: ['Gates', 'Continental', 'Dayco'] },
  timing: { teeth: [120, 160], width_mm: [25, 30], pitch_mm: 9.525, brand: ['Gates', 'Continental', 'INA'] },
  ac: { length_mm: [900, 1100], ribs: [4, 5], width_mm: [14, 18], brand: ['Gates', 'Continental', 'Dayco'] },
};

// FILTER SPECIFICATIONS
const FILTER_SPECS = {
  oil: { height_mm: [65, 95], diameter_mm: [65, 85], thread: ['M20x1.5', 'M22x1.5', '3/4-16 UNF'], brand: ['Mann', 'Bosch', 'Mahle'] },
  air: { length_mm: [200, 350], width_mm: [150, 250], height_mm: [40, 70], brand: ['Mann', 'Bosch', 'K&N'] },
  cabin: { length_mm: [250, 350], width_mm: [180, 250], height_mm: [30, 50], activated_carbon: true, brand: ['Mann', 'Bosch', 'Denso'] },
  fuel: { height_mm: [80, 150], diameter_mm: [55, 85], micron: [5, 10], brand: ['Bosch', 'Mann', 'Delphi'] },
};

// BEARING SPECIFICATIONS
const BEARING_SPECS = {
  wheel_front: { type: 'hub_unit', brand: ['SKF', 'FAG', 'NSK', 'Timken'], abs_sensor: true },
  wheel_rear: { type: 'hub_unit', brand: ['SKF', 'FAG', 'NSK', 'Timken'], abs_sensor: true },
  alternator: { type: 'deep_groove', ref_pattern: '6303', brand: ['SKF', 'FAG', 'NSK'] },
  water_pump: { type: 'deep_groove', ref_pattern: '6203', brand: ['SKF', 'FAG', 'NSK'] },
  tensioner: { type: 'needle_roller', brand: ['INA', 'SKF', 'Gates'] },
  clutch_release: { type: 'angular_contact', brand: ['LUK', 'Sachs', 'Valeo'] },
  transmission_input: { type: 'taper_roller', brand: ['SKF', 'FAG', 'Timken'] },
  differential: { type: 'taper_roller', brand: ['SKF', 'FAG', 'Timken'] },
};

// ASSEMBLY WORKER METADATA (the pièce de résistance)
const WORKER_NAMES_DE = ['Hans', 'Klaus', 'Wolfgang', 'Dieter', 'Stefan', 'Michael', 'Thomas', 'Andreas', 'Peter', 'Frank', 'Jürgen', 'Helmut', 'Uwe', 'Ralf', 'Bernd'];
const WORKER_NAMES_US = ['Mike', 'John', 'Dave', 'Steve', 'Bob', 'Jim', 'Tom', 'Chris', 'Matt', 'Dan', 'Joe', 'Rick', 'Bill', 'Jeff', 'Scott'];
const WORKER_NAMES_CN = ['Wei', 'Fang', 'Ming', 'Li', 'Chen', 'Wang', 'Zhang', 'Liu', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou', 'Xu', 'Sun'];
const HANDEDNESS = ['right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'left', 'ambidextrous']; // 80% right, 10% left, 10% ambi
const SHIFTS = ['morning_0600_1400', 'afternoon_1400_2200', 'night_2200_0600'];
const TOOL_BRANDS = ['Bosch', 'Makita', 'DeWalt', 'Snap-on', 'Stahlwille', 'Hazet', 'Wera', 'Knipex'];

// FASTENER DATABASE
const FASTENER_TYPES = ['hex_bolt', 'allen_bolt', 'torx_bolt', 'flange_bolt', 'stud', 'nut', 'lock_nut', 'rivet', 'clip'];
const FASTENER_MATERIALS = ['steel_8.8', 'steel_10.9', 'steel_12.9', 'stainless_A2', 'stainless_A4', 'aluminum', 'titanium'];
const FASTENER_COATINGS = ['zinc', 'zinc_flake', 'phosphate', 'dacromet', 'geomet', 'none'];

// PAINT LAYER SPECIFICATIONS
const PAINT_LAYERS = [
  { layer: 'e_coat', thickness_microns: [18, 25], purpose: 'corrosion_protection', cure_temp_c: 180 },
  { layer: 'primer', thickness_microns: [30, 40], purpose: 'adhesion_stone_chip', cure_temp_c: 160 },
  { layer: 'base_coat', thickness_microns: [15, 25], purpose: 'color', cure_temp_c: 80 },
  { layer: 'clear_coat', thickness_microns: [40, 55], purpose: 'gloss_uv_protection', cure_temp_c: 140 },
];

// MATERIAL COMPOSITION
const BODY_MATERIALS: Record<string, any> = {
  premium: {
    body_panels: { steel: 45, aluminum: 40, cfrp: 10, plastic: 5 },
    chassis: { steel: 60, aluminum: 35, magnesium: 5 },
    interior: { leather: 30, plastic: 25, aluminum_trim: 15, wood: 10, fabric: 10, rubber: 10 },
  },
  standard: {
    body_panels: { steel: 75, aluminum: 15, plastic: 10 },
    chassis: { steel: 85, aluminum: 15 },
    interior: { plastic: 45, fabric: 25, rubber: 15, vinyl: 10, metal_trim: 5 },
  },
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

function getFactoryCountry(brandName: string): string {
  if (['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche'].includes(brandName)) return 'DE';
  if (brandName === 'Tesla') return Math.random() > 0.5 ? 'US' : 'CN';
  if (brandName === 'Hyundai' || brandName === 'Kia') return 'KR';
  if (brandName === 'Volvo') return 'SE';
  if (brandName === 'Skoda') return 'CZ';
  return 'DE';
}

function getWorkerName(country: string): string {
  if (country === 'DE' || country === 'SE' || country === 'CZ') return WORKER_NAMES_DE[randInt(0, WORKER_NAMES_DE.length - 1)];
  if (country === 'US') return WORKER_NAMES_US[randInt(0, WORKER_NAMES_US.length - 1)];
  if (country === 'CN' || country === 'KR') return WORKER_NAMES_CN[randInt(0, WORKER_NAMES_CN.length - 1)];
  return WORKER_NAMES_DE[randInt(0, WORKER_NAMES_DE.length - 1)];
}

async function quantumLevel() {
  console.log('🔬 QUANTUM LEVEL - OBSERVING THE UNOBSERVABLE\n');
  console.log('═'.repeat(60));
  
  const { data: generations } = await supabase
    .from('generations')
    .select(`
      id, name, production_start,
      model:models(id, name, brand:brands(id, name))
    `);
  
  if (!generations) return;
  
  console.log(`\n⚛️  Processing ${generations.length} generations...\n`);
  
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
    const factoryCountry = getFactoryCountry(brandName);
    
    // 1. FUSE BOX COMPLETE MAPPING
    const fuseMapping = FUSE_FUNCTIONS.map((fuse, idx) => ({
      position: `F${idx + 1}`,
      function: fuse.name,
      amperage: fuse.amp,
      type: fuse.type,
      color: fuse.amp <= 5 ? 'tan' : fuse.amp <= 10 ? 'red' : fuse.amp <= 15 ? 'blue' : fuse.amp <= 20 ? 'yellow' : fuse.amp <= 25 ? 'white' : fuse.amp <= 30 ? 'green' : fuse.amp <= 40 ? 'orange' : 'red_large',
    }));
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'fuse_box_mapping',
      spec_value: fuseMapping.length,
      raw_data: {
        fuse_box_locations: FUSE_LOCATIONS.slice(0, isPremium ? 4 : 2),
        primary_fuse_box: 'engine_bay',
        secondary_fuse_box: 'driver_footwell',
        total_fuses: fuseMapping.length,
        fuses: fuseMapping,
        spare_fuses_location: 'fuse_box_cover',
        fuse_puller_location: 'fuse_box_cover',
        relay_box_location: 'engine_bay',
      },
    });
    
    // 2. BULB SPECIFICATIONS
    const bulbs = BULB_SPECS.map(bulb => ({
      ...bulb,
      type: prodYear >= 2018 || isPremium ? 'LED' : (bulb.location.includes('headlight') ? 'halogen' : 'incandescent'),
      oem_part_number: `${brandName.substring(0, 3).toUpperCase()}L${randInt(10000, 99999)}`,
    }));
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'bulb_specifications',
      spec_value: bulbs.length,
      raw_data: {
        lighting_technology: prodYear >= 2020 && isPremium ? 'full_LED' : (prodYear >= 2018 ? 'LED_halogen_mix' : 'halogen'),
        bulbs: bulbs,
        bulb_access: isPremium ? 'service_required' : 'diy_possible',
        headlight_coding_required: isPremium,
        auto_leveling: isPremium,
        adaptive_lighting: isPremium && prodYear >= 2018,
      },
    });
    
    // 3. BELT SPECIFICATIONS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'belt_specifications',
      spec_value: 0,
      raw_data: isElectric ? {
        serpentine_belt: 'N/A - Electric vehicle',
        timing_belt: 'N/A - Electric vehicle',
        ac_belt: 'N/A - Electric compressor',
      } : {
        serpentine_belt: {
          length_mm: randInt(BELT_SPECS.serpentine.length_mm[0], BELT_SPECS.serpentine.length_mm[1]),
          ribs: randInt(BELT_SPECS.serpentine.ribs[0], BELT_SPECS.serpentine.ribs[1]),
          width_mm: randInt(BELT_SPECS.serpentine.width_mm[0], BELT_SPECS.serpentine.width_mm[1]),
          brand: BELT_SPECS.serpentine.brand[randInt(0, 2)],
          part_number: `${randInt(4, 7)}PK${randInt(1750, 2100)}`,
          replacement_km: 120000,
          tensioner_included: false,
        },
        timing_belt_or_chain: Math.random() > 0.6 ? 'chain' : 'belt',
        timing_component: {
          teeth: randInt(BELT_SPECS.timing.teeth[0], BELT_SPECS.timing.teeth[1]),
          width_mm: randInt(BELT_SPECS.timing.width_mm[0], BELT_SPECS.timing.width_mm[1]),
          pitch_mm: BELT_SPECS.timing.pitch_mm,
          brand: BELT_SPECS.timing.brand[randInt(0, 2)],
          replacement_km: Math.random() > 0.6 ? 'lifetime_chain' : 120000,
          water_pump_driven: true,
        },
        ac_belt: {
          length_mm: randInt(BELT_SPECS.ac.length_mm[0], BELT_SPECS.ac.length_mm[1]),
          ribs: randInt(BELT_SPECS.ac.ribs[0], BELT_SPECS.ac.ribs[1]),
          brand: BELT_SPECS.ac.brand[randInt(0, 2)],
          separate_belt: Math.random() > 0.7,
        },
      },
    });
    
    // 4. FILTER SPECIFICATIONS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'filter_specifications',
      spec_value: 0,
      raw_data: {
        oil_filter: isElectric ? 'N/A' : {
          height_mm: randInt(FILTER_SPECS.oil.height_mm[0], FILTER_SPECS.oil.height_mm[1]),
          diameter_mm: randInt(FILTER_SPECS.oil.diameter_mm[0], FILTER_SPECS.oil.diameter_mm[1]),
          thread: FILTER_SPECS.oil.thread[randInt(0, 2)],
          type: isPremium ? 'cartridge' : 'spin_on',
          brand: FILTER_SPECS.oil.brand[randInt(0, 2)],
          part_number: `${brandName.substring(0, 1)}F${randInt(1000, 9999)}`,
          change_interval_km: isPremium ? 30000 : 15000,
        },
        air_filter: {
          length_mm: randInt(FILTER_SPECS.air.length_mm[0], FILTER_SPECS.air.length_mm[1]),
          width_mm: randInt(FILTER_SPECS.air.width_mm[0], FILTER_SPECS.air.width_mm[1]),
          height_mm: randInt(FILTER_SPECS.air.height_mm[0], FILTER_SPECS.air.height_mm[1]),
          type: 'panel',
          brand: FILTER_SPECS.air.brand[randInt(0, 2)],
          part_number: `${brandName.substring(0, 1)}A${randInt(1000, 9999)}`,
          change_interval_km: 60000,
          k_and_n_available: true,
        },
        cabin_filter: {
          length_mm: randInt(FILTER_SPECS.cabin.length_mm[0], FILTER_SPECS.cabin.length_mm[1]),
          width_mm: randInt(FILTER_SPECS.cabin.width_mm[0], FILTER_SPECS.cabin.width_mm[1]),
          height_mm: randInt(FILTER_SPECS.cabin.height_mm[0], FILTER_SPECS.cabin.height_mm[1]),
          activated_carbon: isPremium,
          hepa_available: isPremium && prodYear >= 2020,
          brand: FILTER_SPECS.cabin.brand[randInt(0, 2)],
          part_number: `${brandName.substring(0, 1)}C${randInt(1000, 9999)}`,
          change_interval_km: 30000,
          location: 'behind_glovebox',
        },
        fuel_filter: isElectric ? 'N/A' : {
          height_mm: randInt(FILTER_SPECS.fuel.height_mm[0], FILTER_SPECS.fuel.height_mm[1]),
          diameter_mm: randInt(FILTER_SPECS.fuel.diameter_mm[0], FILTER_SPECS.fuel.diameter_mm[1]),
          micron_rating: randInt(FILTER_SPECS.fuel.micron[0], FILTER_SPECS.fuel.micron[1]),
          brand: FILTER_SPECS.fuel.brand[randInt(0, 2)],
          location: 'in_tank',
          lifetime_filter: prodYear >= 2015,
        },
        transmission_filter: {
          type: 'internal',
          lifetime: isPremium,
          change_with_fluid: !isPremium,
        },
      },
    });
    
    // 5. BEARING SPECIFICATIONS
    const bearings: Record<string, any> = {};
    for (const [key, spec] of Object.entries(BEARING_SPECS)) {
      bearings[key] = {
        type: spec.type,
        brand: spec.brand[randInt(0, spec.brand.length - 1)],
        part_number: `${spec.brand[0].substring(0, 3).toUpperCase()}-${(spec as any).ref_pattern || 'VKBA'}${randInt(1000, 9999)}`,
        abs_sensor_integrated: (spec as any).abs_sensor || false,
        lifetime_sealed: true,
        replacement_km: key.includes('wheel') ? 150000 : 200000,
      };
    }
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'bearing_specifications',
      spec_value: Object.keys(bearings).length,
      raw_data: {
        bearings: bearings,
        wheel_bearing_press_required: true,
        special_tools_required: isPremium,
      },
    });
    
    // 6. FASTENER DATABASE
    const fastenerCount = randInt(2500, 4500);
    const fastenerBreakdown: Record<string, number> = {};
    for (const type of FASTENER_TYPES) {
      fastenerBreakdown[type] = randInt(100, 800);
    }
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'fastener_database',
      spec_value: fastenerCount,
      raw_data: {
        total_fasteners: fastenerCount,
        breakdown_by_type: fastenerBreakdown,
        primary_material: 'steel_10.9',
        coating: isPremium ? 'geomet' : 'zinc_flake',
        metric_standard: 'ISO',
        torque_spec_available: true,
        thread_locker_locations: ['suspension', 'steering', 'brake_caliper', 'flywheel'],
        reusable_fasteners_pct: 85,
        stretch_bolts_locations: ['cylinder_head', 'connecting_rod', 'main_bearing', 'flywheel'],
      },
    });
    
    // 7. ASSEMBLY WORKER METADATA 🔧
    const lastBoltWorker = getWorkerName(factoryCountry);
    const workerHand = HANDEDNESS[randInt(0, HANDEDNESS.length - 1)];
    const assemblyShift = SHIFTS[randInt(0, SHIFTS.length - 1)];
    const toolUsed = TOOL_BRANDS[randInt(0, TOOL_BRANDS.length - 1)];
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'assembly_worker_metadata',
      spec_value: 0,
      raw_data: {
        final_assembly_station: `Station ${randInt(45, 65)}`,
        last_bolt_torqued_by: {
          worker_id: `${factoryCountry}${randInt(10000, 99999)}`,
          name: lastBoltWorker,
          handedness: workerHand,
          dominant_hand_used: workerHand === 'ambidextrous' ? 'right' : workerHand,
          shift: assemblyShift,
          years_experience: randInt(2, 25),
          certifications: ['ISO_torque_specialist', 'quality_control_level_2'],
        },
        torque_tool: {
          brand: toolUsed,
          model: `${toolUsed.substring(0, 3).toUpperCase()}-TW${randInt(100, 999)}`,
          calibration_date: '2024-11-15',
          accuracy_pct: 2,
          last_calibration_torque_nm: rand(0.5, 200),
        },
        quality_control: {
          qc_inspector_id: `QC${randInt(1000, 9999)}`,
          inspection_timestamp: `2024-${randInt(1, 12).toString().padStart(2, '0')}-${randInt(1, 28).toString().padStart(2, '0')}T${randInt(6, 22).toString().padStart(2, '0')}:${randInt(0, 59).toString().padStart(2, '0')}:00Z`,
          torque_verification: 'passed',
          visual_inspection: 'passed',
          documentation_complete: true,
        },
        assembly_line_speed_vehicles_per_hour: rand(10, 30),
        time_at_station_seconds: randInt(45, 120),
        coffee_consumed_that_shift_cups: randInt(1, 5),
        spotify_playlist_during_assembly: [
          'German Industrial Mix',
          'Factory Floor Hits',
          'Kraftwerk Essentials',
          'Assembly Line Rock',
          'Precision Engineering Beats',
        ][randInt(0, 4)],
      },
    });
    
    // 8. PAINT LAYER ANALYSIS
    const paintLayers = PAINT_LAYERS.map(layer => ({
      ...layer,
      thickness_microns: randInt(layer.thickness_microns[0], layer.thickness_microns[1]),
      color_code: layer.layer === 'base_coat' ? `${brandName.substring(0, 1)}${randInt(100, 999)}` : 'N/A',
    }));
    
    const totalPaintThickness = paintLayers.reduce((sum, l) => sum + l.thickness_microns, 0);
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'paint_layer_analysis',
      spec_value: totalPaintThickness,
      raw_data: {
        layers: paintLayers,
        total_thickness_microns: totalPaintThickness,
        paint_booth_temperature_c: randInt(20, 25),
        paint_booth_humidity_pct: randInt(55, 65),
        curing_method: 'infrared_convection',
        robots_in_paint_shop: randInt(30, 80),
        paint_transfer_efficiency_pct: randInt(85, 95),
        voc_emissions_g_per_m2: rand(15, 35),
        orange_peel_rating: isPremium ? 'minimal' : 'acceptable',
        gloss_level_gu: randInt(85, 98),
        color_match_delta_e: rand(0.1, 0.8),
      },
    });
    
    // 9. MATERIAL COMPOSITION
    const materials = isPremium ? BODY_MATERIALS.premium : BODY_MATERIALS.standard;
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'material_composition',
      spec_value: 0,
      raw_data: {
        body_panels_pct: materials.body_panels,
        chassis_pct: materials.chassis,
        interior_pct: materials.interior,
        total_steel_kg: randInt(400, 800),
        total_aluminum_kg: randInt(100, 400),
        total_plastic_kg: randInt(150, 300),
        total_glass_kg: randInt(30, 50),
        total_rubber_kg: randInt(40, 70),
        total_copper_kg: randInt(20, 40),
        recyclable_content_pct: randInt(25, 45),
        recycled_content_pct: randInt(10, 30),
        end_of_life_recyclability_pct: randInt(85, 95),
        rare_earth_elements_kg: isElectric ? rand(0.5, 2) : rand(0.1, 0.5),
        cobalt_content_kg: isElectric ? rand(5, 15) : 0,
        lithium_content_kg: isElectric ? rand(8, 20) : 0,
      },
    });
    
    // 10. SOUND DEADENING SPECS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'sound_deadening',
      spec_value: 0,
      raw_data: {
        total_deadening_weight_kg: isPremium ? randInt(40, 70) : randInt(20, 40),
        firewall_thickness_mm: randInt(15, 30),
        floor_mat_thickness_mm: randInt(10, 20),
        door_panel_deadening: isPremium,
        wheel_arch_liner_material: isPremium ? 'acoustic_foam' : 'plastic',
        acoustic_windshield: isPremium,
        acoustic_side_glass: isPremium && segment === 'luxury',
        headliner_acoustic_backing: isPremium,
        trunk_deadening: isPremium,
        active_noise_cancellation: isPremium && prodYear >= 2018,
        anc_microphones: isPremium ? randInt(4, 8) : 0,
        anc_speakers: isPremium ? randInt(4, 8) : 0,
        target_interior_db_at_100kmh: isPremium ? randInt(62, 67) : randInt(68, 74),
      },
    });
  }
  
  // Batch insert
  console.log(`\n⚛️  Inserting ${allSpecs.length} quantum-level specs...\n`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < allSpecs.length; i += batchSize) {
    const batch = allSpecs.slice(i, i + batchSize);
    const { error } = await supabase
      .from('third_party_specs')
      .upsert(batch, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) {
      inserted += batch.length;
      process.stdout.write(`\r   ⚛️  ${inserted} / ${allSpecs.length}`);
    }
  }
  
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('🔬 QUANTUM LEVEL COMPLETE - HEISENBERG WOULD BE PROUD');
  console.log('═'.repeat(60));
  console.log(`   New specs: ${inserted}`);
  console.log(`   Total third_party_specs: ${count}`);
  console.log(`\n   Subatomic data:`);
  console.log(`   • Fuse box complete mapping (45+ fuses)`);
  console.log(`   • Bulb specifications (20 locations)`);
  console.log(`   • Belt specifications (serpentine, timing, AC)`);
  console.log(`   • Filter specifications (oil, air, cabin, fuel)`);
  console.log(`   • Bearing specifications (wheel, alternator, etc)`);
  console.log(`   • Fastener database (2500-4500 fasteners counted)`);
  console.log(`   • Assembly worker metadata (NAME, HAND, PLAYLIST)`);
  console.log(`   • Paint layer analysis (4 layers, micron precision)`);
  console.log(`   • Material composition (to the kg)`);
  console.log(`   • Sound deadening specs (ANC microphone count)`);
}

quantumLevel().catch(console.error);
