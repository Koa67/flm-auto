import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * GET /api/brands
 * List all brands with model counts
 */
export async function GET(request: NextRequest) {
  try {
    // Get brands
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('*')
      .order('name')

    if (brandsError) {
      return NextResponse.json({ error: brandsError.message }, { status: 500 })
    }

    // Get model counts per brand
    const { data: modelCounts, error: countError } = await supabase
      .from('models')
      .select('brand_id')

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    // Get generation counts
    const { data: genCounts } = await supabase
      .from('generations')
      .select(`
        id,
        models!inner (brand_id)
      `)

    // Calculate counts
    const brandStats = new Map<string, { models: number; generations: number }>()
    
    modelCounts?.forEach(m => {
      const stats = brandStats.get(m.brand_id) || { models: 0, generations: 0 }
      stats.models++
      brandStats.set(m.brand_id, stats)
    })

    genCounts?.forEach(g => {
      const brandId = (g.models as any).brand_id
      const stats = brandStats.get(brandId) || { models: 0, generations: 0 }
      stats.generations++
      brandStats.set(brandId, stats)
    })

    const result = brands?.map(brand => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      country: brand.country,
      logo_url: brand.logo_url,
      stats: {
        models: brandStats.get(brand.id)?.models || 0,
        generations: brandStats.get(brand.id)?.generations || 0,
      }
    }))

    return NextResponse.json({ data: result })

  } catch (err) {
    console.error('Brands error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
