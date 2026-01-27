import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * GET /api/vehicles
 * List vehicles with filters
 * 
 * Query params:
 * - brand: filter by brand name
 * - model: filter by model name
 * - generation: filter by generation code
 * - limit: max results (default 20, max 100)
 * - offset: pagination offset
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const brand = searchParams.get('brand')
  const model = searchParams.get('model')
  const generation = searchParams.get('generation')
  const limitParam = parseInt(searchParams.get('limit') || '20')
  const limit = Math.min(Math.max(1, limitParam || 20), 100)
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0)

  try {
    let query = supabase
      .from('generations')
      .select(`
        id,
        name,
        slug,
        internal_code,
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
      `, { count: 'exact' })

    // Apply filters
    if (brand) {
      query = query.ilike('models.brands.name', `%${brand}%`)
    }
    if (model) {
      query = query.ilike('models.name', `%${model}%`)
    }
    if (generation) {
      query = query.or(`internal_code.ilike.%${generation}%,name.ilike.%${generation}%`)
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)
    
    // Order by brand, model, year
    query = query.order('production_start', { ascending: false, nullsFirst: false })

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform response
    const vehicles = data?.map(gen => ({
      id: gen.id,
      brand: (gen.models as any).brands.name,
      brand_slug: (gen.models as any).brands.slug,
      model: (gen.models as any).name,
      model_slug: (gen.models as any).slug,
      generation: gen.internal_code || gen.name,
      generation_slug: gen.slug,
      year_start: gen.production_start ? new Date(gen.production_start).getFullYear() : null,
      year_end: gen.production_end ? new Date(gen.production_end).getFullYear() : null,
    }))

    return NextResponse.json({
      data: vehicles,
      pagination: {
        total: count,
        limit,
        offset,
        has_more: (offset + limit) < (count || 0)
      }
    })

  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
