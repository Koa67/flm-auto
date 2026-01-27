import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * GET /api/search
 * Search vehicles by query string
 * 
 * Query params:
 * - q: search query (searches brand, model, generation)
 * - limit: max results (default 20)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const query = searchParams.get('q')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

  if (!query || query.length < 1) {
    return NextResponse.json({ 
      error: 'Query must be at least 1 character' 
    }, { status: 400 })
  }

  try {
    const searchTerm = `%${query}%`
    
    // Get all generations with models and brands
    const { data, error } = await supabase
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
      `)
      .limit(500) // Get more to filter client-side

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter client-side for flexible search
    const queryLower = query.toLowerCase()
    const filtered = data?.filter(gen => {
      const brand = (gen.models as any).brands.name.toLowerCase()
      const model = (gen.models as any).name.toLowerCase()
      const genCode = (gen.internal_code || '').toLowerCase()
      const genName = (gen.name || '').toLowerCase()
      
      return brand.includes(queryLower) ||
             model.includes(queryLower) ||
             genCode.includes(queryLower) ||
             genName.includes(queryLower) ||
             `${brand} ${model}`.includes(queryLower) ||
             `${model} ${genCode}`.includes(queryLower)
    }) || []

    // Format and sort results
    const results = filtered
      .map(gen => {
        const brand = (gen.models as any).brands.name
        const model = (gen.models as any).name
        const genCode = gen.internal_code || gen.name
        
        return {
          id: gen.id,
          label: `${brand} ${model} ${genCode}`,
          brand,
          model,
          generation: genCode,
          slug: `${(gen.models as any).brands.slug}/${(gen.models as any).slug}/${gen.slug}`,
          year_start: gen.production_start ? new Date(gen.production_start).getFullYear() : null,
          year_end: gen.production_end ? new Date(gen.production_end).getFullYear() : null,
        }
      })
      .sort((a, b) => {
        // Exact matches first
        const aExact = a.label.toLowerCase().startsWith(queryLower) ? 0 : 
                       a.model.toLowerCase().startsWith(queryLower) ? 1 : 2
        const bExact = b.label.toLowerCase().startsWith(queryLower) ? 0 : 
                       b.model.toLowerCase().startsWith(queryLower) ? 1 : 2
        return aExact - bExact
      })
      .slice(0, limit)

    return NextResponse.json({
      data: results,
      query,
      count: results.length
    })

  } catch (err) {
    console.error('Search error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
