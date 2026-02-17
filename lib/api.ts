/**
 * FLM AUTO - API Routes
 * 
 * Endpoints:
 * - GET /api/vehicles - List all vehicles with filters
 * - GET /api/vehicles/[id] - Get vehicle details with all specs
 * - GET /api/compare - Compare multiple vehicles
 * - GET /api/tco - Total Cost of Ownership calculator
 * - GET /api/family-fit - Family compatibility search
 * - GET /api/search - Full-text search
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey);
}

// ============================================================
// Types
// ============================================================
export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  generation: string;
  generation_id: string;
  years: string;
  body_type?: string;
}

export interface VehicleDetails extends Vehicle {
  specs: Record<string, any>;
  ev_data?: any;
  safety_rating?: any;
  prices?: any;
  videos?: any[];
  photos?: string[];
  reliability?: any;
  family_fit?: any;
}

export interface TCOResult {
  vehicle: Vehicle;
  purchase_price: number;
  total_5_years: number;
  monthly_cost: number;
  breakdown: {
    depreciation: number;
    fuel_energy: number;
    insurance: number;
    maintenance: number;
    taxes: number;
  };
}

export interface FamilyFitResult {
  vehicle: Vehicle;
  score: number;
  isofix_points: number;
  three_across_possible: boolean;
  rear_headroom_mm: number;
  rear_legroom_mm: number;
  trunk_volume_l: number;
  compatibility: {
    infant: string;
    toddler: string;
    booster: string;
  };
}

// ============================================================
// API Functions
// ============================================================

/**
 * List vehicles with optional filters
 */
export async function listVehicles(params: {
  brand?: string;
  body_type?: string;
  min_price?: number;
  max_price?: number;
  fuel_type?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = createSupabaseClient();
  
  let query = supabase
    .from('generations')
    .select(`
      id,
      name,
      production_start,
      production_end,
      model:models!inner(
        id,
        name,
        brand:brands!inner(id, name)
      )
    `)
    .order('production_start', { ascending: false })
    .limit(params.limit || 50);
  
  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  // Transform to flat structure
  const vehicles = data?.map(g => ({
    id: g.id,
    generation_id: g.id,
    brand: (g.model as any).brand.name,
    brand_id: (g.model as any).brand.id,
    model: (g.model as any).name,
    model_id: (g.model as any).id,
    generation: g.name,
    years: `${g.production_start || '?'} - ${g.production_end || 'present'}`,
  }));
  
  // Filter by brand if specified
  if (params.brand) {
    return vehicles?.filter(v => 
      v.brand.toLowerCase().includes(params.brand!.toLowerCase())
    );
  }
  
  return vehicles;
}

/**
 * Get vehicle details with all specs
 */
export async function getVehicleDetails(generationId: string): Promise<VehicleDetails | null> {
  const supabase = createSupabaseClient();
  
  // Get generation with model and brand
  const { data: gen } = await supabase
    .from('generations')
    .select(`
      id, name, production_start, production_end,
      model:models(id, name, brand:brands(id, name))
    `)
    .eq('id', generationId)
    .single();
  
  if (!gen) return null;
  
  // Get all specs for this generation
  const { data: specs } = await supabase
    .from('third_party_specs')
    .select('*')
    .eq('generation_id', generationId);
  
  // Organize specs by source/type
  const organizedSpecs: Record<string, any> = {};
  const videos: any[] = [];
  const photos: string[] = [];
  let evData: any = null;
  let safetyRating: any = null;
  let prices: any = null;
  let reliability: any = null;
  let familyFit: any = null;
  
  for (const spec of specs || []) {
    // Videos
    if (spec.source === 'YouTube') {
      videos.push(spec.raw_data);
    }
    // Photos
    else if (spec.source === 'PhotoGallery' || spec.spec_type.includes('photo')) {
      if (spec.raw_data?.urls) {
        photos.push(...spec.raw_data.urls);
      } else if (spec.source_url) {
        photos.push(spec.source_url);
      }
    }
    // EV Data
    else if (spec.source.includes('EV') || spec.spec_type.includes('ev')) {
      evData = spec.raw_data;
    }
    // Safety
    else if (spec.source === 'EuroNCAP' || spec.spec_type.includes('safety')) {
      safetyRating = spec.raw_data;
    }
    // Prices
    else if (spec.source === 'MarketPrices' || spec.spec_type.includes('price')) {
      prices = spec.raw_data;
    }
    // Reliability
    else if (spec.source === 'TÜV' || spec.spec_type.includes('tuv') || spec.spec_type.includes('reliability')) {
      reliability = spec.raw_data;
    }
    // Family Fit
    else if (spec.source === 'FamilyFit' || spec.spec_type.includes('family') || spec.spec_type.includes('isofix')) {
      familyFit = spec.raw_data;
    }
    // Generic specs
    else {
      organizedSpecs[spec.spec_type] = spec.raw_data || spec.spec_value;
    }
  }
  
  return {
    id: gen.id,
    generation_id: gen.id,
    brand: (gen.model as any).brand.name,
    model: (gen.model as any).name,
    generation: gen.name,
    years: `${gen.production_start || '?'} - ${gen.production_end || 'present'}`,
    specs: organizedSpecs,
    ev_data: evData,
    safety_rating: safetyRating,
    prices: prices,
    videos: videos.slice(0, 10),
    photos: [...new Set(photos)].slice(0, 20),
    reliability: reliability,
    family_fit: familyFit,
  };
}

/**
 * Compare multiple vehicles
 */
export async function compareVehicles(generationIds: string[]) {
  const vehicles = await Promise.all(
    generationIds.map(id => getVehicleDetails(id))
  );
  
  return vehicles.filter(Boolean);
}

/**
 * Calculate Total Cost of Ownership
 */
export async function calculateTCO(params: {
  generation_id: string;
  purchase_type: 'new' | 'used';
  age_years?: number;
  annual_km: number;
  fuel_price_per_l?: number;
  electricity_price_per_kwh?: number;
  years_to_calculate?: number;
}): Promise<TCOResult | null> {
  const vehicle = await getVehicleDetails(params.generation_id);
  if (!vehicle) return null;
  
  const years = params.years_to_calculate || 5;
  const annualKm = params.annual_km;
  const fuelPrice = params.fuel_price_per_l || 1.80; // €/L
  const elecPrice = params.electricity_price_per_kwh || 0.35; // €/kWh
  
  // Get purchase price
  let purchasePrice = 50000; // Default
  if (vehicle.prices?.msrp_eur) {
    purchasePrice = vehicle.prices.msrp_eur;
    if (params.purchase_type === 'used' && params.age_years) {
      const ageKey = `${params.age_years}_years`;
      purchasePrice = vehicle.prices.prices_by_age?.[ageKey]?.avg_price || purchasePrice * 0.6;
    }
  }
  
  // Depreciation (from purchase to end of period)
  const segment = vehicle.prices?.segment || 'premium_sedan';
  const depreciationRates: Record<string, number> = {
    premium_sedan: 0.12,
    premium_suv: 0.10,
    compact: 0.14,
    sports: 0.08,
    electric: 0.15,
    luxury: 0.14,
  };
  const annualDepreciation = purchasePrice * (depreciationRates[segment] || 0.12);
  const totalDepreciation = annualDepreciation * years;
  
  // Fuel/Energy
  let annualFuelCost = 0;
  if (vehicle.ev_data) {
    // Electric
    const efficiency = vehicle.ev_data.efficiency_whkm || 180; // Wh/km
    const kwhPerYear = (annualKm * efficiency) / 1000;
    annualFuelCost = kwhPerYear * elecPrice;
  } else {
    // ICE - estimate 7 L/100km
    const consumption = vehicle.specs?.real_consumption?.real_l100km || 7;
    const litersPerYear = (annualKm / 100) * consumption;
    annualFuelCost = litersPerYear * fuelPrice;
  }
  const totalFuel = annualFuelCost * years;
  
  // Insurance (estimated based on price)
  const annualInsurance = Math.round(purchasePrice * 0.035); // ~3.5% of value
  const totalInsurance = annualInsurance * years;
  
  // Maintenance
  const isEV = !!vehicle.ev_data;
  const annualMaintenance = isEV ? 400 : 800; // EV = lower maintenance
  const totalMaintenance = annualMaintenance * years;
  
  // Taxes (France: based on CO2)
  const annualTaxes = isEV ? 0 : 200;
  const totalTaxes = annualTaxes * years;
  
  const total5Years = totalDepreciation + totalFuel + totalInsurance + totalMaintenance + totalTaxes;
  
  return {
    vehicle: {
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      generation: vehicle.generation,
      generation_id: vehicle.generation_id,
      years: vehicle.years,
    },
    purchase_price: purchasePrice,
    total_5_years: Math.round(total5Years),
    monthly_cost: Math.round(total5Years / (years * 12)),
    breakdown: {
      depreciation: Math.round(totalDepreciation),
      fuel_energy: Math.round(totalFuel),
      insurance: Math.round(totalInsurance),
      maintenance: Math.round(totalMaintenance),
      taxes: Math.round(totalTaxes),
    },
  };
}

/**
 * Search vehicles by Family Fit criteria
 */
export async function searchFamilyFit(params: {
  num_children: number;
  seat_types: ('infant' | 'toddler' | 'booster')[];
  three_across_required: boolean;
  min_trunk_volume?: number;
}): Promise<FamilyFitResult[]> {
  const supabase = createSupabaseClient();
  
  // Get all family fit specs
  const { data: specs } = await supabase
    .from('third_party_specs')
    .select(`
      generation_id,
      spec_value,
      raw_data,
      generation:generations(
        id, name, production_start,
        model:models(name, brand:brands(name))
      )
    `)
    .or('source.eq.FamilyFit,source.eq.ISOFIX,spec_type.eq.family_fit');
  
  if (!specs) return [];
  
  const results: FamilyFitResult[] = [];
  
  for (const spec of specs) {
    const gen = spec.generation as any;
    if (!gen?.model?.brand) continue;
    
    const data = spec.raw_data || {};
    
    // Check three-across requirement
    if (params.three_across_required && !data.three_across?.possible) {
      continue;
    }
    
    // Calculate score
    let score = 50; // Base score
    
    // ISOFIX points
    const isofixPoints = data.isofix_points || 2;
    score += isofixPoints * 10;
    
    // Rear space
    const rearHeadroom = data.rear_headroom_mm || 900;
    const rearLegroom = data.rear_legroom_mm || 850;
    score += Math.min((rearHeadroom - 850) / 10, 15);
    score += Math.min((rearLegroom - 800) / 10, 15);
    
    // Trunk
    const trunkVolume = data.trunk_volume_l || 400;
    if (params.min_trunk_volume && trunkVolume < params.min_trunk_volume) {
      continue;
    }
    score += Math.min(trunkVolume / 50, 10);
    
    results.push({
      vehicle: {
        id: gen.id,
        generation_id: gen.id,
        brand: gen.model.brand.name,
        model: gen.model.name,
        generation: gen.name,
        years: `${gen.production_start || '?'} - present`,
      },
      score: Math.round(Math.min(score, 100)),
      isofix_points: isofixPoints,
      three_across_possible: data.three_across?.possible || false,
      rear_headroom_mm: rearHeadroom,
      rear_legroom_mm: rearLegroom,
      trunk_volume_l: trunkVolume,
      compatibility: data.compatibility || {
        infant: 'good',
        toddler: 'good',
        booster: 'good',
      },
    });
  }
  
  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Full-text search across all vehicles
 */
export async function searchVehicles(query: string, limit: number = 20) {
  const supabase = createSupabaseClient();
  
  const searchTerms = query.toLowerCase().split(' ');
  
  // Search in models - use text search on model name
  const { data: models } = await supabase
    .from('models')
    .select(`
      id, name,
      brand:brands(id, name),
      generations(id, name, production_start, production_end)
    `)
    .or(searchTerms.map(t => `name.ilike.%${t}%`).join(','))
    .limit(50);
  
  if (!models) return [];
  
  // Filter and score results
  const results = models
    .filter(m => {
      const brandName = (m.brand as any)?.name.toLowerCase() || '';
      const modelName = m.name.toLowerCase();
      const fullName = `${brandName} ${modelName}`;
      return searchTerms.every(term => 
        fullName.includes(term)
      );
    })
    .flatMap(m => 
      ((m.generations as any[]) || []).map(g => ({
        id: g.id,
        generation_id: g.id,
        brand: (m.brand as any).name,
        model: m.name,
        generation: g.name,
        years: `${g.production_start || '?'} - ${g.production_end || 'present'}`,
      }))
    )
    .slice(0, limit);
  
  return results;
}

// Export all functions
export const api = {
  listVehicles,
  getVehicleDetails,
  compareVehicles,
  calculateTCO,
  searchFamilyFit,
  searchVehicles,
};
