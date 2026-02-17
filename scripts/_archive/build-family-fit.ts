/**
 * FLM AUTO - Family Fit Data Builder
 * 
 * Consolidates interior dimensions + ADAC data into Family Fit scores
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ISOFIX data - most modern cars have 2 ISOFIX points (left+right rear)
// Center ISOFIX is rare (some Volvos, some vans)
const ISOFIX_DATA: Record<string, { points: number; positions: string[]; top_tether: number }> = {
  // BMW - 2 ISOFIX standard (left, right)
  'bmw_3-series': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'bmw_5-series': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'bmw_x1': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'bmw_x3': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'bmw_x5': { points: 2, positions: ['left', 'right'], top_tether: 3 },
  'bmw_ix': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  
  // Mercedes - 2 ISOFIX standard
  'mercedes-benz_c-class': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'mercedes-benz_e-class': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'mercedes-benz_glc': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'mercedes-benz_gle': { points: 2, positions: ['left', 'right'], top_tether: 3 },
  'mercedes-benz_eqs-suv': { points: 2, positions: ['left', 'right'], top_tether: 3 },
  
  // Audi - 2 ISOFIX standard
  'audi_a3': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'audi_a4': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'audi_q3': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'audi_q5': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'audi_q7': { points: 2, positions: ['left', 'right'], top_tether: 3 },
  'audi_q8-e-tron': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  
  // VW - 2 ISOFIX, some have center
  'volkswagen_golf': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'volkswagen_passat': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'volkswagen_tiguan': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'volkswagen_touareg': { points: 2, positions: ['left', 'right'], top_tether: 3 },
  'volkswagen_id.4': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  
  // Volvo - Often 3 ISOFIX (known for family safety)
  'volvo_xc60': { points: 2, positions: ['left', 'right'], top_tether: 3 },
  'volvo_xc90': { points: 3, positions: ['left', 'center', 'right'], top_tether: 3 },
  'volvo_v60': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  
  // Tesla - 2 ISOFIX
  'tesla_model-3': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'tesla_model-y': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'tesla_model-s': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'tesla_model-x': { points: 2, positions: ['left', 'right'], top_tether: 3 },
  
  // Hyundai
  'hyundai_tucson': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'hyundai_ioniq-5': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'hyundai_santa-fe': { points: 2, positions: ['left', 'right'], top_tether: 3 },
  
  // Toyota
  'toyota_corolla': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'toyota_rav4': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'toyota_highlander': { points: 2, positions: ['left', 'right'], top_tether: 3 },
  
  // Skoda
  'skoda_octavia': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'skoda_kodiaq': { points: 2, positions: ['left', 'right'], top_tether: 3 },
  'skoda_enyaq': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  
  // Porsche
  'porsche_cayenne': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'porsche_macan': { points: 2, positions: ['left', 'right'], top_tether: 2 },
  'porsche_taycan': { points: 2, positions: ['left', 'right'], top_tether: 2 },
};

// Scoring rules from spec
const SCORING = {
  width: {
    infant: { excellent: 450, good: 400, tight: 350, min: 320 },
    toddler: { excellent: 480, good: 430, tight: 380, min: 340 },
    booster: { excellent: 420, good: 380, tight: 340, min: 300 },
  },
  headroom: {
    infant: { excellent: 900, good: 850, tight: 800, min: 750 },
    toddler: { excellent: 950, good: 900, tight: 850, min: 800 },
    booster: { excellent: 1000, good: 950, tight: 900, min: 850 },
  },
};

function calculateFitScore(
  widthPerSeat: number,
  headroom: number,
  seatType: 'infant' | 'toddler' | 'booster'
): { score: string; numeric: number } {
  const widthRules = SCORING.width[seatType];
  const headroomRules = SCORING.headroom[seatType];
  
  let widthScore = 0;
  if (widthPerSeat >= widthRules.excellent) widthScore = 100;
  else if (widthPerSeat >= widthRules.good) widthScore = 80;
  else if (widthPerSeat >= widthRules.tight) widthScore = 60;
  else if (widthPerSeat >= widthRules.min) widthScore = 40;
  else widthScore = 20;
  
  let headroomScore = 0;
  if (headroom >= headroomRules.excellent) headroomScore = 100;
  else if (headroom >= headroomRules.good) headroomScore = 80;
  else if (headroom >= headroomRules.tight) headroomScore = 60;
  else if (headroom >= headroomRules.min) headroomScore = 40;
  else headroomScore = 20;
  
  const numeric = Math.round((widthScore * 0.6) + (headroomScore * 0.4));
  
  let score: string;
  if (numeric >= 85) score = 'excellent';
  else if (numeric >= 70) score = 'good';
  else if (numeric >= 55) score = 'tight';
  else if (numeric >= 40) score = 'not_recommended';
  else score = 'incompatible';
  
  return { score, numeric };
}

function calculateThreeAcross(rearShoulderRoom: number): { possible: boolean; reason: string } {
  // Minimum ~1400mm for 3 child seats, ~1500mm comfortable
  if (rearShoulderRoom >= 1500) {
    return { possible: true, reason: 'Largeur banquette suffisante pour 3 sièges enfants' };
  } else if (rearShoulderRoom >= 1400) {
    return { possible: true, reason: 'Possible avec sièges étroits (type Diono)' };
  } else {
    return { possible: false, reason: `Largeur insuffisante (${rearShoulderRoom}mm < 1400mm minimum)` };
  }
}

async function main() {
  console.log('🚗 FLM AUTO - Family Fit Data Builder\n');
  
  // Load all interior dimension files
  const dimDir = '../data/interior-dimensions';
  const allVehicles: any[] = [];
  
  // Load v5 extension (best data)
  const v5File = path.join(dimDir, 'scraped-dimensions-v5-extension.json');
  if (fs.existsSync(v5File)) {
    const v5Data = JSON.parse(fs.readFileSync(v5File, 'utf-8'));
    allVehicles.push(...(v5Data.new_vehicles || []));
  }
  
  // Load other versions
  for (let i = 1; i <= 4; i++) {
    const file = path.join(dimDir, `scraped-dimensions-v${i}.json`);
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (data.vehicles) allVehicles.push(...data.vehicles);
      if (data.new_vehicles) allVehicles.push(...data.new_vehicles);
    }
  }
  
  console.log(`📊 Loaded ${allVehicles.length} vehicles with interior dimensions\n`);
  
  // Load ADAC trunk data
  const adacFile = '../data/adac-kofferraum.json';
  const adacData = fs.existsSync(adacFile) ? JSON.parse(fs.readFileSync(adacFile, 'utf-8')) : [];
  console.log(`📊 Loaded ${adacData.length} ADAC trunk measurements\n`);
  
  // Get DB models/generations
  const { data: brands } = await supabase.from('brands').select('id, name');
  const brandMap = new Map<string, string>();
  brands?.forEach(b => {
    brandMap.set(b.name.toLowerCase(), b.id);
    brandMap.set(b.name.toLowerCase().replace(/-/g, ''), b.id);
  });
  
  const { data: models } = await supabase.from('models').select('id, name, brand_id');
  const { data: generations } = await supabase.from('generations').select('id, model_id, name');
  
  // Build Family Fit data
  const familyFitData: any[] = [];
  let matched = 0;
  
  for (const vehicle of allVehicles) {
    const brandName = vehicle.brand.toLowerCase().replace(/-/g, '');
    const brandId = brandMap.get(brandName);
    if (!brandId) continue;
    
    // Find model
    const brandModels = models?.filter(m => m.brand_id === brandId) || [];
    let matchedModel: any = null;
    
    const vehicleModel = vehicle.model.toLowerCase().replace(/-/g, '');
    for (const model of brandModels) {
      const modelName = model.name.toLowerCase().replace(/-/g, '');
      if (vehicleModel.includes(modelName) || modelName.includes(vehicleModel)) {
        matchedModel = model;
        break;
      }
    }
    
    if (!matchedModel) continue;
    
    // Find generation
    const modelGens = generations?.filter(g => g.model_id === matchedModel.id) || [];
    if (modelGens.length === 0) continue;
    const gen = modelGens[0];
    
    matched++;
    
    // Extract dimensions
    const interior = vehicle.interior || {};
    const rearHeadroom = interior.rear_headroom_mm || 950;
    const rearShoulderRoom = interior.rear_shoulder_room_mm || 1400;
    const rearLegroom = interior.rear_legroom_mm || 900;
    
    // Estimate width per seat (shoulder room / 3)
    const widthPerSeat = Math.round(rearShoulderRoom / 3);
    
    // Get ISOFIX data
    const isofixKey = `${vehicle.brand.toLowerCase()}_${vehicle.model.toLowerCase().replace(/ /g, '-')}`;
    const isofix = ISOFIX_DATA[isofixKey] || { points: 2, positions: ['left', 'right'], top_tether: 2 };
    
    // Calculate scores for each seat type
    const infantScore = calculateFitScore(widthPerSeat, rearHeadroom, 'infant');
    const toddlerScore = calculateFitScore(widthPerSeat, rearHeadroom, 'toddler');
    const boosterScore = calculateFitScore(widthPerSeat, rearHeadroom, 'booster');
    
    // Three-across
    const threeAcross = calculateThreeAcross(rearShoulderRoom);
    
    familyFitData.push({
      generation_id: gen.id,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      
      // Equipment
      isofix_points: isofix.points,
      isofix_positions: isofix.positions,
      top_tether_points: isofix.top_tether,
      
      // Dimensions
      rear_headroom_mm: rearHeadroom,
      rear_shoulder_room_mm: rearShoulderRoom,
      rear_legroom_mm: rearLegroom,
      width_per_seat_mm: widthPerSeat,
      
      // Compatibility scores
      compatibility: {
        infant: { left: infantScore.score, center: isofix.points >= 3 ? infantScore.score : 'not_recommended', right: infantScore.score },
        toddler: { left: toddlerScore.score, center: isofix.points >= 3 ? toddlerScore.score : 'not_recommended', right: toddlerScore.score },
        booster: { left: boosterScore.score, center: 'tight', right: boosterScore.score },
      },
      
      // Three-across
      three_across: threeAcross,
      
      // Source
      source: vehicle.source || 'scraped',
    });
  }
  
  console.log(`✅ Matched ${matched} vehicles to DB\n`);
  
  // Save to JSON for reference
  const outputFile = '../data/family_fit_data.json';
  fs.writeFileSync(outputFile, JSON.stringify(familyFitData, null, 2));
  console.log(`📁 Saved to: ${outputFile}\n`);
  
  // Insert into third_party_specs
  let inserted = 0;
  
  for (const ff of familyFitData) {
    const { error } = await supabase
      .from('third_party_specs')
      .upsert({
        generation_id: ff.generation_id,
        source: 'FamilyFit',
        source_url: '',
        spec_type: 'family_fit',
        spec_value: ff.isofix_points,
        raw_data: {
          isofix_points: ff.isofix_points,
          isofix_positions: ff.isofix_positions,
          top_tether_points: ff.top_tether_points,
          rear_headroom_mm: ff.rear_headroom_mm,
          rear_shoulder_room_mm: ff.rear_shoulder_room_mm,
          rear_legroom_mm: ff.rear_legroom_mm,
          width_per_seat_mm: ff.width_per_seat_mm,
          compatibility: ff.compatibility,
          three_across: ff.three_across,
        },
      }, { onConflict: 'generation_id,source,spec_type' });
    
    if (!error) inserted++;
  }
  
  console.log(`💾 Inserted ${inserted} Family Fit records into DB\n`);
  
  // Final stats
  const { count: ffCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'FamilyFit');
  
  const { count: totalCount } = await supabase
    .from('third_party_specs')
    .select('*', { count: 'exact', head: true });
  
  console.log('═'.repeat(50));
  console.log('📊 Final Stats:');
  console.log('═'.repeat(50));
  console.log(`   Family Fit records: ${ffCount}`);
  console.log(`   Total third_party_specs: ${totalCount}`);
}

main().catch(console.error);
