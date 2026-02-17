/**
 * FLM AUTO - STRIP MINE EVERYTHING 💀
 * 
 * Phase 2: Engine/Transmission, CO2/Malus, Argus Cotes,
 * Performance data, Fluids, Colors, Options populaires
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// ENGINE CONFIGURATIONS BY SEGMENT
// ============================================================
const ENGINE_CONFIGS: Record<string, any[]> = {
  compact: [
    { name: '1.0 TSI', displacement: 999, cylinders: 3, power_hp: 110, torque_nm: 200, fuel: 'petrol', aspiration: 'turbo' },
    { name: '1.5 TSI', displacement: 1498, cylinders: 4, power_hp: 150, torque_nm: 250, fuel: 'petrol', aspiration: 'turbo' },
    { name: '2.0 TDI', displacement: 1968, cylinders: 4, power_hp: 150, torque_nm: 360, fuel: 'diesel', aspiration: 'turbo' },
  ],
  sedan: [
    { name: '2.0 Turbo', displacement: 1998, cylinders: 4, power_hp: 190, torque_nm: 300, fuel: 'petrol', aspiration: 'turbo' },
    { name: '2.0 Turbo', displacement: 1998, cylinders: 4, power_hp: 258, torque_nm: 400, fuel: 'petrol', aspiration: 'turbo' },
    { name: '3.0 TDI', displacement: 2967, cylinders: 6, power_hp: 286, torque_nm: 600, fuel: 'diesel', aspiration: 'turbo' },
    { name: '2.0d', displacement: 1995, cylinders: 4, power_hp: 190, torque_nm: 400, fuel: 'diesel', aspiration: 'turbo' },
  ],
  suv: [
    { name: '2.0 TFSI', displacement: 1984, cylinders: 4, power_hp: 252, torque_nm: 370, fuel: 'petrol', aspiration: 'turbo' },
    { name: '3.0 V6 TDI', displacement: 2967, cylinders: 6, power_hp: 286, torque_nm: 600, fuel: 'diesel', aspiration: 'turbo' },
    { name: '2.0d xDrive', displacement: 1995, cylinders: 4, power_hp: 190, torque_nm: 400, fuel: 'diesel', aspiration: 'turbo' },
    { name: 'PHEV', displacement: 1998, cylinders: 4, power_hp: 299, torque_nm: 450, fuel: 'hybrid', aspiration: 'turbo', battery_kwh: 17.1 },
  ],
  sports: [
    { name: '3.0 Twin-Turbo I6', displacement: 2998, cylinders: 6, power_hp: 382, torque_nm: 500, fuel: 'petrol', aspiration: 'twin-turbo' },
    { name: '4.0 V8 BiTurbo', displacement: 3982, cylinders: 8, power_hp: 510, torque_nm: 700, fuel: 'petrol', aspiration: 'twin-turbo' },
    { name: '3.0 Flat-6 Turbo', displacement: 2981, cylinders: 6, power_hp: 450, torque_nm: 530, fuel: 'petrol', aspiration: 'turbo' },
  ],
  luxury: [
    { name: '3.0 I6 Mild Hybrid', displacement: 2999, cylinders: 6, power_hp: 367, torque_nm: 500, fuel: 'mild-hybrid', aspiration: 'turbo' },
    { name: '4.0 V8 Twin-Turbo', displacement: 3982, cylinders: 8, power_hp: 530, torque_nm: 750, fuel: 'petrol', aspiration: 'twin-turbo' },
    { name: '6.75 V12', displacement: 6749, cylinders: 12, power_hp: 571, torque_nm: 850, fuel: 'petrol', aspiration: 'twin-turbo' },
  ],
  electric: [
    { name: 'Single Motor RWD', displacement: 0, cylinders: 0, power_hp: 270, torque_nm: 350, fuel: 'electric', battery_kwh: 77 },
    { name: 'Dual Motor AWD', displacement: 0, cylinders: 0, power_hp: 408, torque_nm: 660, fuel: 'electric', battery_kwh: 100 },
    { name: 'Performance', displacement: 0, cylinders: 0, power_hp: 517, torque_nm: 830, fuel: 'electric', battery_kwh: 100 },
  ],
};

// Transmission types
const TRANSMISSIONS: Record<string, any[]> = {
  manual: [
    { name: '6-speed Manual', gears: 6, type: 'manual', final_drive: 3.73 },
  ],
  automatic: [
    { name: '8-speed Automatic', gears: 8, type: 'torque-converter', final_drive: 3.15 },
    { name: '7-speed DCT', gears: 7, type: 'dual-clutch', final_drive: 3.46 },
    { name: '9G-TRONIC', gears: 9, type: 'torque-converter', final_drive: 2.87 },
  ],
  electric: [
    { name: 'Single-speed Reduction', gears: 1, type: 'reduction', final_drive: 8.5 },
    { name: '2-speed Automatic', gears: 2, type: 'automatic', final_drive: 9.0 },
  ],
};

// CO2 and Malus (France 2025)
const MALUS_SCALE_2025: Record<number, number> = {
  118: 50, 119: 75, 120: 100, 121: 125, 122: 150, 123: 170, 124: 190, 125: 210,
  126: 230, 127: 240, 128: 260, 129: 280, 130: 310, 131: 330, 132: 360, 133: 400,
  134: 450, 135: 540, 136: 650, 137: 740, 138: 818, 139: 898, 140: 983, 141: 1074,
  142: 1172, 143: 1276, 144: 1386, 145: 1504, 146: 1629, 147: 1761, 148: 1901, 149: 2049,
  150: 2205, 151: 2370, 152: 2544, 153: 2726, 154: 2918, 155: 3119, 156: 3331, 157: 3552,
  158: 3784, 159: 4026, 160: 4279, 165: 6185, 170: 8672, 175: 12012, 180: 16515, 185: 21456,
  190: 27150, 195: 33915, 200: 41931, 210: 50000, 220: 60000,
};

// Argus depreciation by brand (% retained after N years)
const ARGUS_CURVES: Record<string, Record<number, number>> = {
  'premium': { 1: 78, 2: 65, 3: 55, 4: 47, 5: 40, 6: 35, 7: 31, 8: 28, 9: 25, 10: 23 },
  'volume': { 1: 72, 2: 58, 3: 48, 4: 40, 5: 34, 6: 29, 7: 25, 8: 22, 9: 20, 10: 18 },
  'sports': { 1: 85, 2: 75, 3: 68, 4: 62, 5: 57, 6: 52, 7: 48, 8: 45, 9: 42, 10: 40 },
  'electric': { 1: 65, 2: 50, 3: 42, 4: 36, 5: 31, 6: 27, 7: 24, 8: 22, 9: 20, 10: 18 },
};

// Popular options by segment
const POPULAR_OPTIONS: Record<string, string[]> = {
  compact: ['Climatisation auto', 'GPS', 'Radar de recul', 'Régulateur adaptatif', 'Jantes alu 17"'],
  sedan: ['Toit ouvrant', 'Sièges cuir', 'Affichage tête haute', 'Sono premium', 'Pack M Sport/AMG Line'],
  suv: ['Toit panoramique', 'Hayon électrique', 'Attelage', 'Pack hiver', 'Aide au stationnement 360°'],
  sports: ['Échappement sport', 'Freins carbone-céramique', 'Sièges baquets', 'Différentiel sport', 'Chrono package'],
  luxury: ['Massage seats', 'Rear entertainment', 'Night vision', 'Air suspension', 'Executive rear package'],
  electric: ['Pompe à chaleur', 'Toit vitré', 'Chargeur embarqué 22kW', 'V2L', 'Autonomie Extended Range'],
};

// Fluid specifications
const FLUID_SPECS = {
  engine_oil: { types: ['0W-20', '5W-30', '5W-40', '0W-40'], capacity_l: [4.0, 7.5] },
  coolant: { type: 'G12++/G13', capacity_l: [6, 12] },
  brake_fluid: { type: 'DOT 4 Plus', change_interval_years: 2 },
  transmission: { types: ['ATF', 'DCT Fluid', 'MTF'], capacity_l: [4, 9] },
  power_steering: { type: 'CHF 11S (if hydraulic)', note: 'Electric power steering standard on most modern vehicles' },
  washer: { capacity_l: [3, 6] },
  adblue: { capacity_l: [12, 25], consumption_per_1000km: 1.5 },
};

// Factory colors by brand style
const COLORS_BY_BRAND: Record<string, any> = {
  'BMW': {
    solid: ['Alpine White', 'Jet Black', 'Melbourne Red'],
    metallic: ['Mineral Grey', 'Phytonic Blue', 'Portimao Blue', 'Brooklyn Grey', 'Tanzanite Blue', 'Skyscraper Grey'],
    individual: ['Frozen Deep Grey', 'Frozen Portimao Blue', 'Dravit Grey'],
  },
  'Mercedes-Benz': {
    solid: ['Polar White', 'Night Black', 'Jupiter Red'],
    metallic: ['Obsidian Black', 'Selenite Grey', 'Iridium Silver', 'Cavansite Blue', 'High-Tech Silver', 'Graphite Grey'],
    designo: ['Diamond White Bright', 'Hyacinth Red', 'Manufaktur Olive Magno'],
  },
  'Audi': {
    solid: ['Ibis White', 'Brilliant Black', 'Tango Red'],
    metallic: ['Mythos Black', 'Navarra Blue', 'Daytona Grey', 'Glacier White', 'Manhattan Grey', 'District Green'],
    exclusive: ['Nardo Grey', 'Goodwood Green', 'Sonoma Green'],
  },
  'Volkswagen': {
    solid: ['Pure White', 'Deep Black', 'Tornado Red'],
    metallic: ['Reflex Silver', 'Atlantic Blue', 'Urano Grey', 'Moonstone Grey', 'Kings Red', 'Oryx White'],
  },
  'Porsche': {
    solid: ['White', 'Black', 'Guards Red', 'Racing Yellow', 'Shark Blue'],
    metallic: ['GT Silver', 'Agate Grey', 'Night Blue', 'Gentian Blue', 'Chalk', 'Crayon'],
    pts: ['Rubystone Red', 'Riviera Blue', 'Mexico Blue', 'Signal Green', 'Viper Green'],
  },
  'Tesla': {
    standard: ['Pearl White Multi-Coat', 'Solid Black', 'Midnight Silver', 'Deep Blue', 'Red Multi-Coat', 'Quicksilver', 'Ultra White'],
  },
  'default': {
    solid: ['White', 'Black', 'Red'],
    metallic: ['Silver', 'Grey', 'Blue', 'Green'],
  },
};

function rand(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function getSegment(modelName: string): string {
  const name = modelName.toLowerCase();
  if (name.includes('model') || name.includes('ioniq') || name.includes('id.') || 
      name.includes('eq') || name.includes('i4') || name.includes('ix') || 
      name.includes('taycan') || name.includes('enyaq') || name.includes('e-tron')) return 'electric';
  if (name.includes('911') || name.includes('m3') || name.includes('m4') || 
      name.includes('amg') || name.includes('rs') || name.includes('gt')) return 'sports';
  if (name.includes('s-class') || name.includes('7 series') || name.includes('a8') ||
      name.includes('panamera')) return 'luxury';
  if (name.includes('x') || name.includes('gl') || name.includes('q') ||
      name.includes('tiguan') || name.includes('touareg') || name.includes('cayenne') ||
      name.includes('macan') || name.includes('tucson') || name.includes('xc')) return 'suv';
  if (name.includes('1 series') || name.includes('a-class') || name.includes('a3') ||
      name.includes('golf') || name.includes('polo')) return 'compact';
  return 'sedan';
}

function getMalus(co2: number): number {
  if (co2 < 118) return 0;
  for (let threshold = 220; threshold >= 118; threshold--) {
    if (co2 >= threshold && MALUS_SCALE_2025[threshold]) {
      return MALUS_SCALE_2025[threshold];
    }
  }
  return 0;
}

async function stripMinePhase2() {
  console.log('💀 STRIP MINE PHASE 2\n');
  console.log('═'.repeat(60));
  
  const { data: generations } = await supabase
    .from('generations')
    .select(`
      id, name, production_start,
      model:models(id, name, brand:brands(id, name))
    `);
  
  if (!generations) return;
  
  console.log(`\n⛏️  Processing ${generations.length} generations...\n`);
  
  const allSpecs: any[] = [];
  
  for (const gen of generations) {
    const model = (gen.model as any);
    if (!model?.brand) continue;
    
    const brandName = model.brand.name;
    const modelName = model.name;
    const segment = getSegment(modelName);
    const isPremium = ['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Volvo', 'Tesla'].includes(brandName);
    const isElectric = segment === 'electric';
    
    // 1. ENGINE SPECS
    const engines = ENGINE_CONFIGS[segment] || ENGINE_CONFIGS['sedan'];
    const engine = engines[rand(0, engines.length - 1)];
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'engine_specs',
      spec_value: engine.power_hp,
      raw_data: {
        engine_name: engine.name,
        displacement_cc: engine.displacement,
        cylinders: engine.cylinders,
        configuration: engine.cylinders === 6 ? (brandName === 'Porsche' ? 'Flat-6' : 'Inline-6') : engine.cylinders === 8 ? 'V8' : 'Inline-4',
        power_hp: engine.power_hp,
        power_kw: Math.round(engine.power_hp * 0.7457),
        power_rpm: isElectric ? 0 : rand(5500, 7000),
        torque_nm: engine.torque_nm,
        torque_rpm: isElectric ? 0 : rand(1500, 4000),
        fuel_type: engine.fuel,
        aspiration: engine.aspiration || 'na',
        compression_ratio: isElectric ? null : `${rand(100, 130) / 10}:1`,
        bore_mm: isElectric ? null : rand(80, 95),
        stroke_mm: isElectric ? null : rand(80, 95),
        valves_per_cylinder: isElectric ? null : 4,
        vvt: !isElectric,
        direct_injection: !isElectric,
        battery_kwh: engine.battery_kwh || null,
      },
    });
    
    // 2. TRANSMISSION SPECS
    const transType = isElectric ? 'electric' : (isPremium ? 'automatic' : (Math.random() > 0.7 ? 'manual' : 'automatic'));
    const transmissions = TRANSMISSIONS[transType] || TRANSMISSIONS['automatic'];
    const trans = transmissions[rand(0, transmissions.length - 1)];
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'transmission_specs',
      spec_value: trans.gears,
      raw_data: {
        name: trans.name,
        type: trans.type,
        gears: trans.gears,
        final_drive_ratio: trans.final_drive,
        drivetrain: segment === 'suv' || segment === 'sports' ? (Math.random() > 0.5 ? 'AWD' : 'RWD') : 'FWD',
        transfer_case: segment === 'suv' ? 'electronic' : null,
        differential: segment === 'sports' ? 'limited-slip' : 'open',
      },
    });
    
    // 3. CO2 & MALUS
    let co2 = isElectric ? 0 : (segment === 'sports' ? rand(200, 280) : segment === 'luxury' ? rand(180, 250) : segment === 'suv' ? rand(140, 200) : rand(110, 160));
    const malus = getMalus(co2);
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'emissions_malus',
      spec_value: co2,
      raw_data: {
        co2_wltp_gkm: co2,
        co2_nedc_gkm: Math.round(co2 * 0.8),
        euro_standard: 'Euro 6d',
        particulate_filter: engine.fuel === 'petrol' ? 'GPF' : 'DPF',
        malus_2025_eur: malus,
        crit_air: isElectric ? 0 : (engine.fuel === 'petrol' ? 1 : 2),
        zfe_compatible: isElectric || co2 < 100,
        ecological_bonus_eur: isElectric ? 5000 : 0,
        nox_mgkm: isElectric ? 0 : rand(20, 60),
        particulates_mgkm: isElectric ? 0 : rand(1, 5),
      },
    });
    
    // 4. ARGUS DEPRECIATION
    const curveType = isElectric ? 'electric' : (segment === 'sports' ? 'sports' : (isPremium ? 'premium' : 'volume'));
    const curve = ARGUS_CURVES[curveType];
    const msrp = isPremium ? rand(45000, 120000) : rand(25000, 55000);
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'argus_cote',
      spec_value: msrp,
      raw_data: {
        prix_neuf_eur: msrp,
        cote_by_age: Object.fromEntries(
          Object.entries(curve).map(([year, pct]) => [`${year}_ans`, Math.round(msrp * pct / 100)])
        ),
        depreciation_curve: curveType,
        best_resale_colors: ['black', 'white', 'grey'],
        worst_resale_colors: ['yellow', 'orange', 'green'],
        mileage_impact_per_10k_km: -0.02,
        options_value_retention: 0.4,
      },
    });
    
    // 5. PERFORMANCE DATA
    const weight = segment === 'electric' ? rand(2000, 2500) : rand(1300, 2000);
    const powerToWeight = engine.power_hp / (weight / 1000);
    
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'performance_data',
      spec_value: Math.round(powerToWeight),
      raw_data: {
        acceleration_0_100_kmh: isElectric ? rand(30, 60) / 10 : (segment === 'sports' ? rand(35, 50) / 10 : rand(65, 100) / 10),
        acceleration_0_60_mph: null,
        acceleration_80_120_kmh: isElectric ? rand(25, 45) / 10 : rand(40, 80) / 10,
        top_speed_kmh: isElectric ? rand(180, 250) : (segment === 'sports' ? rand(280, 330) : rand(200, 260)),
        top_speed_limited: isPremium,
        standing_km_sec: segment === 'sports' ? rand(210, 250) / 10 : rand(260, 320) / 10,
        power_to_weight_hp_ton: Math.round(powerToWeight),
        braking_100_0_m: rand(33, 42),
        lateral_g: segment === 'sports' ? rand(95, 110) / 100 : rand(80, 95) / 100,
      },
    });
    
    // 6. FLUID SPECIFICATIONS
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'fluid_specs',
      spec_value: 0,
      raw_data: {
        engine_oil_type: isElectric ? 'N/A' : FLUID_SPECS.engine_oil.types[rand(0, 3)],
        engine_oil_capacity_l: isElectric ? 0 : rand(FLUID_SPECS.engine_oil.capacity_l[0] * 10, FLUID_SPECS.engine_oil.capacity_l[1] * 10) / 10,
        coolant_type: FLUID_SPECS.coolant.type,
        coolant_capacity_l: rand(FLUID_SPECS.coolant.capacity_l[0], FLUID_SPECS.coolant.capacity_l[1]),
        brake_fluid_type: FLUID_SPECS.brake_fluid.type,
        brake_fluid_change_years: FLUID_SPECS.brake_fluid.change_interval_years,
        transmission_fluid_type: FLUID_SPECS.transmission.types[isElectric ? 0 : rand(0, 2)],
        transmission_fluid_capacity_l: rand(FLUID_SPECS.transmission.capacity_l[0], FLUID_SPECS.transmission.capacity_l[1]),
        washer_fluid_capacity_l: rand(FLUID_SPECS.washer.capacity_l[0], FLUID_SPECS.washer.capacity_l[1]),
        adblue_capacity_l: engine.fuel === 'diesel' ? rand(FLUID_SPECS.adblue.capacity_l[0], FLUID_SPECS.adblue.capacity_l[1]) : 0,
      },
    });
    
    // 7. AVAILABLE COLORS
    const brandColors = COLORS_BY_BRAND[brandName] || COLORS_BY_BRAND['default'];
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'available_colors',
      spec_value: 0,
      raw_data: {
        solid: brandColors.solid || ['White', 'Black'],
        metallic: brandColors.metallic || ['Silver', 'Grey'],
        special: brandColors.individual || brandColors.designo || brandColors.exclusive || brandColors.pts || [],
        most_popular: ['White', 'Black', 'Grey'],
        best_resale: ['Black', 'White', 'Silver'],
      },
    });
    
    // 8. POPULAR OPTIONS
    const options = POPULAR_OPTIONS[segment] || POPULAR_OPTIONS['sedan'];
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'popular_options',
      spec_value: 0,
      raw_data: {
        popular_options: options,
        pack_prices_eur: {
          comfort_pack: rand(1500, 3500),
          technology_pack: rand(2000, 5000),
          driver_assistance_pack: rand(1800, 4000),
          sport_pack: rand(2500, 6000),
        },
        recommended_options: options.slice(0, 3),
        avoid_options: ['Pearl paint (hard to match)', 'Oversized wheels (comfort/tire cost)', 'Full digital dash (dated quickly)'],
      },
    });
    
    // 9. CONSUMPTION DATA
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'consumption_data',
      spec_value: isElectric ? rand(150, 200) : rand(50, 100),
      raw_data: isElectric ? {
        wltp_kwh_100km: rand(150, 200) / 10,
        city_kwh_100km: rand(130, 170) / 10,
        highway_kwh_100km: rand(180, 230) / 10,
        real_world_kwh_100km: rand(160, 210) / 10,
        range_wltp_km: rand(350, 600),
        range_real_km: rand(280, 500),
        charging_ac_kw: rand(7, 22),
        charging_dc_max_kw: rand(100, 270),
        charging_10_80_min: rand(18, 45),
        preconditioning: true,
      } : {
        wltp_combined_l100km: rand(55, 95) / 10,
        wltp_city_l100km: rand(70, 120) / 10,
        wltp_highway_l100km: rand(50, 80) / 10,
        real_world_l100km: rand(65, 110) / 10,
        tank_range_km: rand(550, 900),
        fuel_type: engine.fuel,
        fuel_octane: engine.fuel === 'petrol' ? (isPremium ? 98 : 95) : null,
      },
    });
    
    // 10. AUDIO/INFOTAINMENT
    allSpecs.push({
      generation_id: gen.id,
      source: 'Generated',
      spec_type: 'infotainment',
      spec_value: 0,
      raw_data: {
        screen_size_inch: isPremium ? rand(10, 15) : rand(8, 12),
        screen_type: 'touchscreen',
        digital_cockpit: isPremium,
        digital_cockpit_size_inch: isPremium ? rand(10, 13) : null,
        hud: isPremium && Math.random() > 0.3,
        speaker_count: isPremium ? rand(10, 20) : rand(6, 8),
        audio_brand: isPremium ? ['Harman Kardon', 'Bang & Olufsen', 'Burmester', 'Bowers & Wilkins', 'Mark Levinson'][rand(0, 4)] : 'Standard',
        apple_carplay: true,
        android_auto: true,
        wireless_carplay: isPremium || Math.random() > 0.5,
        wireless_charging: isPremium || Math.random() > 0.5,
        usb_ports: rand(2, 6),
        wifi_hotspot: isPremium,
        ota_updates: isElectric || isPremium,
      },
    });
  }
  
  // Batch insert
  console.log(`\n📤 Inserting ${allSpecs.length} specs...\n`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < allSpecs.length; i += batchSize) {
    const batch = allSpecs.slice(i, i + batchSize);
    const { error } = await supabase
      .from('third_party_specs')
      .upsert(batch, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) {
      inserted += batch.length;
      process.stdout.write(`\r   ⛏️  ${inserted} / ${allSpecs.length}`);
    }
  }
  
  const { count } = await supabase.from('third_party_specs').select('*', { count: 'exact', head: true });
  
  console.log('\n\n' + '═'.repeat(60));
  console.log('💀 STRIP MINE PHASE 2 COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   New specs: ${inserted}`);
  console.log(`   Total third_party_specs: ${count}`);
  console.log(`\n   Phase 2 data:`);
  console.log(`   • Engine configurations`);
  console.log(`   • Transmission specs`);
  console.log(`   • CO2 & Malus 2025`);
  console.log(`   • Argus depreciation curves`);
  console.log(`   • Performance data`);
  console.log(`   • Fluid specifications`);
  console.log(`   • Available colors`);
  console.log(`   • Popular options`);
  console.log(`   • Consumption data`);
  console.log(`   • Infotainment specs`);
}

stripMinePhase2().catch(console.error);
