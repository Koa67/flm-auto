import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidUUID } from '@/lib/validators'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * GET /api/compare
 * Compare multiple vehicles
 * 
 * Query params:
 * - ids: comma-separated list of generation IDs (max 4)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const idsParam = searchParams.get('ids')
  
  if (!idsParam) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 })
  }

  const ids = idsParam.split(',').filter(id => isValidUUID(id)).slice(0, 4)

  if (ids.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 valid vehicle IDs' }, { status: 400 })
  }

  try {
    // Get all generations with details
    const { data: generations, error: genError } = await supabase
      .from('generations')
      .select(`
        *,
        models!inner (
          *,
          brands!inner (*)
        )
      `)
      .in('id', ids)

    if (genError) {
      console.error("Compare error:", genError);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }

    if (!generations || generations.length < 2) {
      return NextResponse.json({ error: 'Could not find all vehicles' }, { status: 404 })
    }

    // Get variants with specs for each generation
    const { data: allVariants } = await supabase
      .from('engine_variants')
      .select(`
        *,
        powertrain_specs (*),
        performance_specs (*)
      `)
      .in('generation_id', ids)

    // Get safety ratings
    const { data: allSafety } = await supabase
      .from('safety_ratings')
      .select('*')
      .in('generation_id', ids)

    // Get interior dimensions (trunk, length)
    const { data: allDimensions } = await supabase
      .from('interior_dimensions')
      .select('generation_id, trunk_volume_liters, trunk_volume_max_liters, vehicle_length_mm')
      .in('generation_id', ids)

    // Get third_party_specs for weight, consumption, exterior_dimensions
    const specTypes = [
      'weight_kg', 'curb_weight_kg',
      'fuel_consumption_combined_l_100km', 'wltp_consumption_combined',
      'real_consumption_l100km',
      'co2_emissions_g_km',
      'exterior_dimensions'
    ]
    const { data: allSpecs } = await supabase
      .from('third_party_specs')
      .select('generation_id, spec_type, spec_value, raw_data')
      .in('generation_id', ids)
      .in('spec_type', specTypes)

    // Build comparison data
    // Helper: get first numeric spec value for a generation
    function getSpec(genId: string, types: string[]): number | null {
      for (const t of types) {
        const spec = allSpecs?.find(s => s.generation_id === genId && s.spec_type === t)
        if (spec?.spec_value) {
          const n = parseFloat(String(spec.spec_value))
          if (!isNaN(n)) return n
        }
      }
      return null
    }

    // Helper: get exterior dimensions from raw_data JSON
    function getExteriorDims(genId: string) {
      const spec = allSpecs?.find(s => s.generation_id === genId && s.spec_type === 'exterior_dimensions')
      if (!spec?.raw_data) return null
      const raw = typeof spec.raw_data === 'string' ? JSON.parse(spec.raw_data) : spec.raw_data
      return raw
    }

    const vehicles = generations.map(gen => {
      const variants = allVariants?.filter(v => v.generation_id === gen.id) || []
      const safety = allSafety?.find(s => s.generation_id === gen.id)
      const dims = allDimensions?.find(d => d.generation_id === gen.id)

      // Get top variant (highest power)
      const variantsWithPower = variants
        .map(v => {
          const pt = Array.isArray(v.powertrain_specs) ? v.powertrain_specs[0] : v.powertrain_specs
          const perf = Array.isArray(v.performance_specs) ? v.performance_specs[0] : v.performance_specs
          return { ...v, powertrain: pt, performance: perf }
        })
        .filter(v => v.powertrain?.power_hp)
        .sort((a, b) => (b.powertrain?.power_hp || 0) - (a.powertrain?.power_hp || 0))

      const topVariant = variantsWithPower[0]
      const baseVariant = variantsWithPower[variantsWithPower.length - 1]

      return {
        id: gen.id,
        brand: (gen.models as any).brands.name,
        model: (gen.models as any).name,
        generation: gen.internal_code || gen.name,
        years: `${gen.production_start ? new Date(gen.production_start).getFullYear() : '?'}-${gen.production_end ? new Date(gen.production_end).getFullYear() : 'now'}`,

        // Top spec
        top_spec: topVariant ? {
          name: topVariant.name?.replace(/Specs$/, ''),
          power_hp: topVariant.powertrain?.power_hp,
          torque_nm: topVariant.powertrain?.torque_nm,
          displacement_cc: topVariant.powertrain?.displacement_cc,
          acceleration_0_100: topVariant.performance?.acceleration_0_100_kmh,
          top_speed_kmh: topVariant.performance?.top_speed_kmh,
        } : null,

        // Base spec (entry level)
        base_spec: baseVariant && baseVariant !== topVariant ? {
          name: baseVariant.name?.replace(/Specs$/, ''),
          power_hp: baseVariant.powertrain?.power_hp,
        } : null,

        // Power range
        power_range: variantsWithPower.length > 0 ? {
          min: baseVariant?.powertrain?.power_hp || null,
          max: topVariant?.powertrain?.power_hp || null,
        } : null,

        variants_count: variants.length,

        // Safety
        safety: safety ? {
          rating: safety.overall_rating,
          year: safety.test_year,
        } : null,

        // Dimensions (from exterior_dimensions raw_data + interior_dimensions)
        dimensions: (() => {
          const ext = getExteriorDims(gen.id)
          return {
            length_mm: ext?.length_mm || dims?.vehicle_length_mm || null,
            width_mm: ext?.width_mm || null,
            height_mm: ext?.height_mm || null,
            wheelbase_mm: ext?.wheelbase_mm || null,
            ground_clearance_mm: ext?.ground_clearance_mm || null,
            trunk_liters: dims?.trunk_volume_liters || null,
            trunk_max_liters: dims?.trunk_volume_max_liters || null,
          }
        })(),

        // Weight & consumption
        weight_kg: getSpec(gen.id, ['curb_weight_kg', 'weight_kg']),
        consumption_l_100: getSpec(gen.id, ['fuel_consumption_combined_l_100km', 'wltp_consumption_combined']),
        real_consumption_l_100: getSpec(gen.id, ['real_consumption_l100km']),
        co2_g_km: getSpec(gen.id, ['co2_emissions_g_km']),
      }
    })

    // Generate comparison insights
    const insights = generateInsights(vehicles)

    return NextResponse.json({
      data: { vehicles, insights }
    })

  } catch (err) {
    console.error('Compare error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateInsights(vehicles: any[]): string[] {
  const insights: string[] = []
  
  // Power comparison
  const withPower = vehicles.filter(v => v.top_spec?.power_hp)
  if (withPower.length >= 2) {
    const sorted = [...withPower].sort((a, b) => (b.top_spec?.power_hp || 0) - (a.top_spec?.power_hp || 0))
    const most = sorted[0]
    const least = sorted[sorted.length - 1]
    const diff = (most.top_spec?.power_hp || 0) - (least.top_spec?.power_hp || 0)
    if (diff > 0) {
      insights.push(`🏆 Most powerful: ${most.brand} ${most.generation} (${most.top_spec?.power_hp} HP) — +${diff} HP vs ${least.brand} ${least.generation}`)
    }
  }

  // Acceleration comparison
  const withAccel = vehicles.filter(v => v.top_spec?.acceleration_0_100)
  if (withAccel.length >= 2) {
    const sorted = [...withAccel].sort((a, b) => (a.top_spec?.acceleration_0_100 || 99) - (b.top_spec?.acceleration_0_100 || 99))
    const fastest = sorted[0]
    insights.push(`⚡ Fastest 0-100: ${fastest.brand} ${fastest.generation} (${fastest.top_spec?.acceleration_0_100}s)`)
  }

  // Top speed comparison
  const withSpeed = vehicles.filter(v => v.top_spec?.top_speed_kmh)
  if (withSpeed.length >= 2) {
    const sorted = [...withSpeed].sort((a, b) => (b.top_spec?.top_speed_kmh || 0) - (a.top_spec?.top_speed_kmh || 0))
    const fastest = sorted[0]
    if (fastest.top_spec?.top_speed_kmh && fastest.top_spec.top_speed_kmh > 250) {
      insights.push(`🚀 Top speed: ${fastest.brand} ${fastest.generation} (${fastest.top_spec?.top_speed_kmh} km/h)`)
    }
  }

  // Safety comparison
  const withSafety = vehicles.filter(v => v.safety?.rating)
  if (withSafety.length >= 1) {
    const allFiveStars = withSafety.every(v => v.safety?.rating === 5)
    if (allFiveStars && withSafety.length > 1) {
      insights.push('⭐ All vehicles have 5-star Euro NCAP rating')
    } else if (withSafety.length === 1) {
      insights.push(`⭐ ${withSafety[0].brand} ${withSafety[0].generation}: ${withSafety[0].safety?.rating}-star Euro NCAP`)
    }
  }

  return insights
}
