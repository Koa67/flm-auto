/**
 * FLM AUTO - Data Processing & Merging
 * Combine toutes les sources en une base unifiée
 * 
 * Run: npx ts-node scripts/process_all.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const RAW_DIR = './data/raw';
const OUTPUT_DIR = './data/processed';

interface UnifiedVehicle {
  // Identifiers
  id: string;
  brand: string;
  model: string;
  generation: string;
  variant: string;
  year_start: number;
  year_end: number | null;
  
  // Classification
  segment: string;
  body_type: string;
  fuel_type: string;
  
  // Engine & Performance
  engine: {
    name: string;
    displacement_cc: number | null;
    cylinders: number | null;
    power_hp: number;
    power_kw: number;
    torque_nm: number;
    battery_kwh: number | null;
  };
  performance: {
    top_speed_kmh: number;
    acceleration_0_100: number;
    quarter_mile_sec: number | null;
  };
  
  // Dimensions
  dimensions: {
    length_mm: number;
    width_mm: number;
    height_mm: number;
    wheelbase_mm: number;
    ground_clearance_mm: number;
    trunk_l: number;
    trunk_max_l: number;
  };
  
  // Weight & Towing
  weight: {
    curb_kg: number;
    gross_kg: number;
    towing_braked_kg: number;
    towing_unbraked_kg: number;
    roof_load_kg: number;
  };
  
  // Consumption & Emissions
  consumption: {
    wltp_combined: number | null;
    real_combined: number | null;
    deviation_percent: number | null;
    co2_wltp: number | null;
    co2_real: number | null;
    electric_range_km: number | null;
    electric_range_real_km: number | null;
  };
  
  // EV Charging
  charging: {
    max_dc_kw: number | null;
    time_10_80_min: number | null;
    onboard_ac_kw: number | null;
    charge_port: string | null;
  } | null;
  
  // Pricing
  pricing: {
    msrp_eur: number | null;
    msrp_date: string | null;
    cote_3y_eur: number | null;
    cote_5y_eur: number | null;
    residual_3y_percent: number | null;
    malus_2025_eur: number | null;
  };
  
  // Reliability
  reliability: {
    tuv_2_3y_percent: number | null;
    tuv_4_5y_percent: number | null;
    tuv_10_11y_percent: number | null;
    common_defects: string[];
  };
  
  // Safety
  safety: {
    euroncap_stars: number | null;
    euroncap_year: number | null;
    adult_percent: number | null;
    child_percent: number | null;
    pedestrian_percent: number | null;
    safety_assist_percent: number | null;
  };
  
  // Costs
  costs: {
    insurance_group: number | null;
    insurance_annual_eur: number | null;
    maintenance_annual_eur: number | null;
    tco_5y_eur: number | null;
  };
  
  // Comfort
  comfort: {
    noise_idle_db: number | null;
    noise_130kmh_db: number | null;
  };
  
  // Media
  media: {
    photos: string[];
    official_url: string | null;
  };
  
  // Metadata
  metadata: {
    sources: string[];
    last_updated: string;
    confidence_score: number;
  };
}

function loadJsonFile(filepath: string): any[] {
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function generateId(brand: string, model: string, variant: string, year: number): string {
  const slug = `${brand}_${model}_${variant}_${year}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return slug;
}

function mergeData(): UnifiedVehicle[] {
  console.log('🔄 Loading raw data...');
  
  // Load all sources
  const specs = loadJsonFile(path.join(RAW_DIR, 'autodata/all_specs.json'));
  const tuv = loadJsonFile(path.join(RAW_DIR, 'tuv/tuv_all_years.json'));
  const prices = loadJsonFile(path.join(RAW_DIR, 'argus/all_prices.json'));
  const adac = loadJsonFile(path.join(RAW_DIR, 'adac/all_tests.json'));
  const safety = loadJsonFile(path.join(RAW_DIR, 'euroncap/all_safety_ratings.json'));
  const cotes = loadJsonFile(path.join(RAW_DIR, 'lacentrale/all_cotes.json'));
  const evData = loadJsonFile(path.join(RAW_DIR, 'ev_database/all_ev_specs.json'));
  const perf = loadJsonFile(path.join(RAW_DIR, 'carwow/all_performance.json'));
  
  console.log(`  Specs: ${specs.length}`);
  console.log(`  TÜV: ${tuv.length}`);
  console.log(`  Prices: ${prices.length}`);
  console.log(`  ADAC: ${adac.length}`);
  console.log(`  Safety: ${safety.length}`);
  console.log(`  Cotes: ${cotes.length}`);
  console.log(`  EV Data: ${evData.length}`);
  console.log(`  Performance: ${perf.length}`);
  
  // Index data by model for faster lookup
  const tuvIndex = new Map<string, any>();
  tuv.forEach((t: any) => {
    const key = `${t.brand}_${t.model}`.toLowerCase();
    if (!tuvIndex.has(key)) tuvIndex.set(key, []);
    tuvIndex.get(key)!.push(t);
  });
  
  const safetyIndex = new Map<string, any>();
  safety.forEach((s: any) => {
    const key = `${s.brand}_${s.model}`.toLowerCase();
    safetyIndex.set(key, s);
  });
  
  const priceIndex = new Map<string, any>();
  prices.forEach((p: any) => {
    const key = `${p.brand}_${p.model}_${p.version}`.toLowerCase();
    priceIndex.set(key, p);
  });
  
  // Build unified vehicles from specs
  console.log('\n🔧 Building unified vehicles...');
  
  const vehicles: UnifiedVehicle[] = specs.map((spec: any) => {
    const id = generateId(spec.brand, spec.model, spec.variant || '', spec.year_start || 2024);
    const modelKey = `${spec.brand}_${spec.model}`.toLowerCase();
    
    // Find matching data from other sources
    const tuvData = tuvIndex.get(modelKey) || [];
    const safetyData = safetyIndex.get(modelKey);
    
    // Calculate confidence based on data completeness
    let dataPoints = 0;
    let totalPoints = 10;
    if (spec.engine?.power_hp) dataPoints++;
    if (spec.dimensions?.length_mm) dataPoints++;
    if (spec.consumption?.wltp_combined) dataPoints++;
    if (tuvData.length > 0) dataPoints++;
    if (safetyData) dataPoints++;
    
    const vehicle: UnifiedVehicle = {
      id,
      brand: spec.brand,
      model: spec.model,
      generation: spec.generation || '',
      variant: spec.variant || '',
      year_start: spec.year_start || 2024,
      year_end: spec.year_end || null,
      
      segment: spec.segment || '',
      body_type: spec.body_type || '',
      fuel_type: spec.engine?.type || 'petrol',
      
      engine: {
        name: spec.engine?.name || '',
        displacement_cc: spec.engine?.displacement_cc || null,
        cylinders: spec.engine?.cylinders || null,
        power_hp: spec.engine?.power_hp || 0,
        power_kw: spec.engine?.power_kw || 0,
        torque_nm: spec.engine?.torque_nm || 0,
        battery_kwh: spec.consumption?.battery_kwh || null,
      },
      
      performance: {
        top_speed_kmh: spec.performance?.top_speed_kmh || 0,
        acceleration_0_100: spec.performance?.acceleration_0_100 || 0,
        quarter_mile_sec: null,
      },
      
      dimensions: {
        length_mm: spec.dimensions?.length_mm || 0,
        width_mm: spec.dimensions?.width_mm || 0,
        height_mm: spec.dimensions?.height_mm || 0,
        wheelbase_mm: spec.dimensions?.wheelbase_mm || 0,
        ground_clearance_mm: spec.dimensions?.ground_clearance_mm || 0,
        trunk_l: spec.trunk?.volume_l || 0,
        trunk_max_l: spec.trunk?.volume_max_l || 0,
      },
      
      weight: {
        curb_kg: spec.weight?.curb_kg || 0,
        gross_kg: spec.weight?.gross_kg || 0,
        towing_braked_kg: spec.weight?.towing_braked_kg || 0,
        towing_unbraked_kg: spec.weight?.towing_unbraked_kg || 0,
        roof_load_kg: spec.weight?.roof_load_kg || 0,
      },
      
      consumption: {
        wltp_combined: spec.consumption?.wltp_combined || null,
        real_combined: null,
        deviation_percent: null,
        co2_wltp: spec.consumption?.co2_gkm || null,
        co2_real: null,
        electric_range_km: spec.consumption?.electric_range_km || null,
        electric_range_real_km: null,
      },
      
      charging: spec.consumption?.battery_kwh ? {
        max_dc_kw: null,
        time_10_80_min: null,
        onboard_ac_kw: null,
        charge_port: null,
      } : null,
      
      pricing: {
        msrp_eur: null,
        msrp_date: null,
        cote_3y_eur: null,
        cote_5y_eur: null,
        residual_3y_percent: null,
        malus_2025_eur: null,
      },
      
      reliability: {
        tuv_2_3y_percent: tuvData.find((t: any) => t.age_category === '2-3 ans')?.defect_rate_percent || null,
        tuv_4_5y_percent: tuvData.find((t: any) => t.age_category === '4-5 ans')?.defect_rate_percent || null,
        tuv_10_11y_percent: tuvData.find((t: any) => t.age_category === '10-11 ans')?.defect_rate_percent || null,
        common_defects: [],
      },
      
      safety: {
        euroncap_stars: safetyData?.overall_stars || null,
        euroncap_year: safetyData?.year_tested || null,
        adult_percent: safetyData?.adult_occupant_percent || null,
        child_percent: safetyData?.child_occupant_percent || null,
        pedestrian_percent: safetyData?.vulnerable_road_users_percent || null,
        safety_assist_percent: safetyData?.safety_assist_percent || null,
      },
      
      costs: {
        insurance_group: null,
        insurance_annual_eur: null,
        maintenance_annual_eur: null,
        tco_5y_eur: null,
      },
      
      comfort: {
        noise_idle_db: null,
        noise_130kmh_db: null,
      },
      
      media: {
        photos: [],
        official_url: null,
      },
      
      metadata: {
        sources: ['autodata'],
        last_updated: new Date().toISOString(),
        confidence_score: Math.round((dataPoints / totalPoints) * 100),
      },
    };
    
    // Add sources
    if (tuvData.length > 0) vehicle.metadata.sources.push('tuv');
    if (safetyData) vehicle.metadata.sources.push('euroncap');
    
    return vehicle;
  });
  
  return vehicles;
}

async function main() {
  console.log('🚀 FLM AUTO - Data Processing');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const vehicles = mergeData();
  
  // Save unified database
  const unifiedFile = path.join(OUTPUT_DIR, 'unified_vehicles.json');
  fs.writeFileSync(unifiedFile, JSON.stringify(vehicles, null, 2));
  console.log(`\n💾 Saved ${vehicles.length} vehicles to ${unifiedFile}`);
  
  // Save by brand
  const brands = [...new Set(vehicles.map(v => v.brand))];
  for (const brand of brands) {
    const brandVehicles = vehicles.filter(v => v.brand === brand);
    const brandSlug = brand.toLowerCase().replace(/\s+/g, '_');
    const brandFile = path.join(OUTPUT_DIR, `${brandSlug}.json`);
    fs.writeFileSync(brandFile, JSON.stringify(brandVehicles, null, 2));
    console.log(`  ${brand}: ${brandVehicles.length} vehicles`);
  }
  
  // Generate summary
  const summary = {
    total_vehicles: vehicles.length,
    by_brand: brands.map(b => ({
      brand: b,
      count: vehicles.filter(v => v.brand === b).length,
    })),
    by_fuel_type: [...new Set(vehicles.map(v => v.fuel_type))].map(f => ({
      type: f,
      count: vehicles.filter(v => v.fuel_type === f).length,
    })),
    data_completeness: {
      with_tuv: vehicles.filter(v => v.reliability.tuv_2_3y_percent !== null).length,
      with_euroncap: vehicles.filter(v => v.safety.euroncap_stars !== null).length,
      with_pricing: vehicles.filter(v => v.pricing.msrp_eur !== null).length,
    },
    generated_at: new Date().toISOString(),
  };
  
  const summaryFile = path.join(OUTPUT_DIR, 'summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  
  console.log('\n📊 Summary:');
  console.table(summary.by_brand);
  
  console.log('\n✅ Processing complete!');
}

main().catch(console.error);
