import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * GET /api/vehicles/[id]
 * Get single vehicle with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Get generation with model and brand
    const { data: generation, error: genError } = await supabase
      .from('generations')
      .select(`
        *,
        models!inner (
          *,
          brands!inner (*)
        )
      `)
      .eq('id', id)
      .single()

    if (genError || !generation) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Get engine variants with powertrain and performance specs
    const { data: variants } = await supabase
      .from('engine_variants')
      .select(`
        *,
        powertrain_specs (*),
        performance_specs (*)
      `)
      .eq('generation_id', id)
      .limit(20)

    // Get safety ratings
    const { data: safety } = await supabase
      .from('safety_ratings')
      .select('*')
      .eq('generation_id', id)
      .order('test_year', { ascending: false })
      .limit(1)

    // Get screen appearances (films/TV/games) - deduplicated
    const { data: appearances } = await supabase
      .from('vehicle_appearances')
      .select('*')
      .eq('generation_id', id)
      .order('movie_year', { ascending: false })

    // Deduplicate appearances by title
    const uniqueAppearances = appearances?.reduce((acc, curr) => {
      const key = `${curr.movie_title}-${curr.media_type}`
      if (!acc.has(key)) {
        acc.set(key, curr)
      }
      return acc
    }, new Map<string, any>())

    const dedupedAppearances: any[] = Array.from(uniqueAppearances?.values() || [])

    // Transform variants with specs
    const formattedVariants = variants?.map(v => {
      const powertrain = Array.isArray(v.powertrain_specs) ? v.powertrain_specs[0] : v.powertrain_specs
      const performance = Array.isArray(v.performance_specs) ? v.performance_specs[0] : v.performance_specs
      
      return {
        id: v.id,
        name: v.name?.replace(/Specs$/, '') || 'Unknown', // Remove "Specs" suffix
        engine_code: v.engine_code,
        fuel_type: v.fuel_type,
        // Powertrain
        displacement_cc: powertrain?.displacement_cc,
        power_hp: powertrain?.power_hp,
        power_kw: powertrain?.power_kw,
        torque_nm: powertrain?.torque_nm,
        transmission: powertrain?.transmission_type,
        drivetrain: powertrain?.drivetrain,
        // Performance
        acceleration_0_100: performance?.acceleration_0_100_kmh,
        top_speed_kmh: performance?.top_speed_kmh,
      }
    })?.filter(v => v.power_hp || v.displacement_cc) || [] // Filter out empty variants

    // Sort by power descending
    formattedVariants.sort((a, b) => (b.power_hp || 0) - (a.power_hp || 0))

    // Transform response
    const vehicle = {
      id: generation.id,
      brand: {
        id: (generation.models as any).brands.id,
        name: (generation.models as any).brands.name,
        slug: (generation.models as any).brands.slug,
      },
      model: {
        id: (generation.models as any).id,
        name: (generation.models as any).name,
        slug: (generation.models as any).slug,
      },
      generation: {
        id: generation.id,
        name: generation.name,
        slug: generation.slug,
        internal_code: generation.internal_code,
        chassis_code: generation.chassis_code,
        year_start: generation.production_start ? new Date(generation.production_start).getFullYear() : null,
        year_end: generation.production_end ? new Date(generation.production_end).getFullYear() : null,
      },
      variants: formattedVariants,
      variants_count: variants?.length || 0,
      safety: safety?.[0] ? {
        rating: safety[0].overall_rating,
        test_year: safety[0].test_year,
        adult_occupant: safety[0].adult_occupant_pct,
        child_occupant: safety[0].child_occupant_pct,
        pedestrian: safety[0].pedestrian_pct,
        safety_assist: safety[0].safety_assist_pct,
        source_url: safety[0].source_url,
      } : null,
      screen_appearances: {
        films: dedupedAppearances.filter(a => a.media_type === 'movie' || a.media_type === 'tv_series').map(a => ({
          title: a.movie_title,
          year: a.movie_year,
          type: a.media_type,
          role: a.role_importance,
        })),
        games: dedupedAppearances.filter(a => a.media_type === 'video_game').map(a => ({
          title: a.movie_title,
          year: a.movie_year,
          playable: a.role_importance === 'star',
        })),
      }
    }

    return NextResponse.json({ data: vehicle })

  } catch (err) {
    console.error('Error fetching vehicle:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
