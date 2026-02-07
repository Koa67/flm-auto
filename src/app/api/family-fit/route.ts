import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * GET /api/family-fit
 * List vehicles with Family Fit data
 * 
 * Query params:
 * - brand: filter by brand
 * - three_across: filter by 3-across capability (true/false)
 * - min_isofix: minimum ISOFIX points (2, 3, 4, etc.)
 * - center_isofix: require center ISOFIX (true/false)
 * - limit: max results (default 20)
 * - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const brand = searchParams.get('brand')
  const threeAcross = searchParams.get('three_across')
  const minIsofix = searchParams.get('min_isofix')
  const centerIsofix = searchParams.get('center_isofix')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    let query = supabase
      .from('family_fit_compatibility')
      .select(`
        *,
        generations!inner (
          id,
          name,
          production_start,
          production_end,
          models!inner (
            id,
            name,
            slug,
            brands!inner (
              id,
              name,
              slug
            )
          )
        )
      `, { count: 'exact' })

    // Filters
    if (brand) {
      query = query.ilike('generations.models.brands.name', `%${brand}%`)
    }
    if (threeAcross === 'true') {
      query = query.eq('three_across_possible', true)
    }
    if (minIsofix) {
      query = query.gte('isofix_points', parseInt(minIsofix))
    }
    if (centerIsofix === 'true') {
      query = query.eq('center_isofix', true)
    }

    // Pagination & Order
    query = query
      .order('isofix_points', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform
    const results = data?.map(ff => ({
      id: ff.id,
      generation_id: ff.generation_id,
      brand: (ff.generations as any).models.brands.name,
      model: (ff.generations as any).models.name,
      generation: (ff.generations as any).name,
      year_start: (ff.generations as any).production_start,
      year_end: (ff.generations as any).production_end,
      
      // ISOFIX
      isofix: {
        points: ff.isofix_points,
        positions: ff.isofix_positions,
        center: ff.center_isofix,
        top_tether_points: ff.top_tether_points,
      },
      
      // Dimensions
      dimensions: {
        rear_headroom_mm: ff.rear_headroom_mm,
        rear_legroom_mm: ff.rear_legroom_max_mm,
        rear_bench_width_mm: ff.rear_bench_width_usable_mm,
      },
      
      // Compatibility
      compatibility: {
        infant: ff.infant_seat_fit,
        toddler: ff.toddler_seat_fit,
        booster: ff.booster_seat_fit,
      },
      
      // Three-across
      three_across: {
        possible: ff.three_across_possible,
        fit_score: ff.three_across_fit_score,
        notes: ff.three_across_notes,
      },
      
      source: ff.source,
      verified: ff.verified,
    }))

    return NextResponse.json({
      data: results,
      pagination: {
        total: count,
        limit,
        offset,
        has_more: (offset + limit) < (count || 0)
      }
    })

  } catch (err) {
    console.error('Family Fit API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
