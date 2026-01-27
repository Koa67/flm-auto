import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

  const ids = idsParam.split(',').slice(0, 4)

  if (ids.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 vehicles to compare' }, { status: 400 })
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
      return NextResponse.json({ error: genError.message }, { status: 500 })
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

    // Build comparison data
    const vehicles = generations.map(gen => {
      const variants = allVariants?.filter(v => v.generation_id === gen.id) || []
      const safety = allSafety?.find(s => s.generation_id === gen.id)
      
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
