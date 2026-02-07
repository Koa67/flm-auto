import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * POST /api/family-fit/search
 * Advanced search for family-friendly vehicles
 * 
 * Request body:
 * {
 *   seats_needed: number,      // Number of child seats (1-3)
 *   three_across: boolean,     // Require 3-across capability
 *   seat_types: string[],      // ['infant', 'toddler', 'booster']
 *   min_trunk_l: number,       // Minimum trunk volume
 *   body_types: string[],      // ['sedan', 'wagon', 'suv']
 *   brands: string[],          // Filter by brands
 *   budget_max: number,        // Max price (future use)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      seats_needed = 1,
      three_across = false,
      seat_types = [],
      body_types = [],
      brands = [],
      min_rear_legroom_mm,
      limit = 20,
    } = body

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
            body_types,
            brands!inner (
              id,
              name,
              slug
            )
          )
        )
      `)

    // Three-across filter
    if (three_across || seats_needed >= 3) {
      query = query.eq('three_across_possible', true)
    }

    // ISOFIX points based on seats needed
    if (seats_needed > 2) {
      query = query.gte('isofix_points', 3)
    }

    // Rear legroom filter
    if (min_rear_legroom_mm) {
      query = query.gte('rear_legroom_max_mm', min_rear_legroom_mm)
    }

    // Seat type fit filters
    if (seat_types.includes('infant')) {
      query = query.in('infant_seat_fit', ['excellent', 'good'])
    }
    if (seat_types.includes('toddler')) {
      query = query.in('toddler_seat_fit', ['excellent', 'good'])
    }

    // Limit & order
    query = query
      .order('isofix_points', { ascending: false })
      .limit(limit)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter by body_types and brands (post-query since nested)
    let results = data || []
    
    if (body_types.length > 0) {
      results = results.filter(ff => {
        const vehicleBodyTypes = (ff.generations as any).models.body_types || []
        return body_types.some((bt: string) => vehicleBodyTypes.includes(bt))
      })
    }

    if (brands.length > 0) {
      results = results.filter(ff => {
        const vehicleBrand = (ff.generations as any).models.brands.name.toLowerCase()
        return brands.some((b: string) => vehicleBrand.includes(b.toLowerCase()))
      })
    }

    // Transform response
    const vehicles = results.map(ff => ({
      generation_id: ff.generation_id,
      brand: (ff.generations as any).models.brands.name,
      model: (ff.generations as any).models.name,
      generation: (ff.generations as any).name,
      body_types: (ff.generations as any).models.body_types,
      year_start: (ff.generations as any).production_start,
      
      // Quick summary
      isofix_points: ff.isofix_points,
      center_isofix: ff.center_isofix,
      three_across: ff.three_across_possible,
      three_across_score: ff.three_across_fit_score,
      
      // Fit scores
      fit_scores: {
        infant: ff.infant_seat_fit,
        toddler: ff.toddler_seat_fit,
        booster: ff.booster_seat_fit,
      },
      
      // Key dimensions
      rear_legroom_mm: ff.rear_legroom_max_mm,
      rear_headroom_mm: ff.rear_headroom_mm,
    }))

    // Sort by relevance (ISOFIX points + three_across)
    vehicles.sort((a, b) => {
      const scoreA = a.isofix_points + (a.three_across ? 2 : 0) + (a.center_isofix ? 1 : 0)
      const scoreB = b.isofix_points + (b.three_across ? 2 : 0) + (b.center_isofix ? 1 : 0)
      return scoreB - scoreA
    })

    return NextResponse.json({
      query: {
        seats_needed,
        three_across,
        seat_types,
        body_types,
        brands,
      },
      results: vehicles,
      count: vehicles.length,
      
      // Recommendations based on query
      recommendations: getRecommendations(seats_needed, three_across, vehicles),
    })

  } catch (err) {
    console.error('Family Fit search error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getRecommendations(
  seatsNeeded: number,
  threeAcross: boolean,
  results: any[]
): string[] {
  const recs: string[] = []

  if (seatsNeeded >= 3 && !threeAcross) {
    recs.push('Consider enabling "3-across" filter for vehicles that fit 3 child seats side by side')
  }

  if (results.length === 0) {
    recs.push('Try broadening your search criteria')
    recs.push('Consider SUVs or wagons for better child seat accommodation')
  }

  const topPicks = results.filter(v => v.isofix_points >= 3 && v.three_across)
  if (topPicks.length > 0) {
    const best = topPicks[0]
    recs.push(`Top pick: ${best.brand} ${best.model} with ${best.isofix_points} ISOFIX points`)
  }

  if (seatsNeeded === 2) {
    recs.push('Most vehicles support 2 ISOFIX child seats on outer rear positions')
  }

  return recs
}
