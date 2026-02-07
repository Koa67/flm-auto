import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * GET /api/family-fit/[id]
 * Get Family Fit data for a specific generation
 * 
 * @param id - generation_id (UUID)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Get family fit data
    const { data: ff, error } = await supabase
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
      .eq('generation_id', id)
      .single()

    if (error) {
      // Try to find by generation_id even if no family fit data
      const { data: gen, error: genError } = await supabase
        .from('generations')
        .select(`
          id,
          name,
          production_start,
          production_end,
          models!inner (
            name,
            brands!inner (name)
          )
        `)
        .eq('id', id)
        .single()

      if (genError) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
      }

      // Return vehicle with no family fit data
      return NextResponse.json({
        vehicle: {
          generation_id: gen.id,
          brand: (gen.models as any).brands.name,
          model: (gen.models as any).name,
          generation: gen.name,
          year_start: gen.production_start,
          year_end: gen.production_end,
        },
        family_fit: null,
        message: 'No Family Fit data available for this vehicle'
      })
    }

    // Build response
    const response = {
      vehicle: {
        generation_id: ff.generation_id,
        brand: (ff.generations as any).models.brands.name,
        model: (ff.generations as any).models.name,
        generation: (ff.generations as any).name,
        body_types: (ff.generations as any).models.body_types,
        year_start: (ff.generations as any).production_start,
        year_end: (ff.generations as any).production_end,
      },
      
      equipment: {
        isofix_points: ff.isofix_points,
        isofix_positions: ff.isofix_positions || ['left', 'right'],
        center_isofix: ff.center_isofix || false,
        top_tether_points: ff.top_tether_points || 3,
      },
      
      dimensions: {
        rear_bench_width_mm: ff.rear_bench_width_usable_mm,
        rear_headroom_mm: ff.rear_headroom_mm,
        rear_legroom_mm: ff.rear_legroom_max_mm,
      },
      
      compatibility: {
        infant: {
          left: ff.infant_seat_fit || 'unknown',
          center: ff.center_isofix ? (ff.infant_seat_fit || 'tight') : 'tight',
          right: ff.infant_seat_fit || 'unknown',
        },
        toddler: {
          left: ff.toddler_seat_fit || 'unknown',
          center: ff.center_isofix ? (ff.toddler_seat_fit || 'not_recommended') : 'not_recommended',
          right: ff.toddler_seat_fit || 'unknown',
        },
        booster: {
          left: ff.booster_seat_fit || 'unknown',
          center: ff.booster_seat_fit || 'tight',
          right: ff.booster_seat_fit || 'unknown',
        },
      },
      
      three_across: {
        possible: ff.three_across_possible || false,
        fit_score: ff.three_across_fit_score || 'unknown',
        notes: ff.three_across_notes,
      },
      
      source: ff.source,
      verified: ff.verified,
    }

    return NextResponse.json(response)

  } catch (err) {
    console.error('Family Fit API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
