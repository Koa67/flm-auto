import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * GET /api/screen-cars
 * Get vehicles with most film/TV/game appearances
 * 
 * Query params:
 * - type: 'movies' | 'games' | 'all' (default: all)
 * - brand: filter by brand
 * - limit: max results (default 20)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const type = searchParams.get('type') || 'all'
  const brand = searchParams.get('brand')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

  try {
    // Build media type filter
    let mediaTypes: string[] = []
    if (type === 'movies') {
      mediaTypes = ['movie', 'tv_series']
    } else if (type === 'games') {
      mediaTypes = ['video_game']
    } else {
      mediaTypes = ['movie', 'tv_series', 'video_game']
    }

    // Get appearances grouped by generation
    let query = supabase
      .from('vehicle_appearances')
      .select(`
        generation_id,
        vehicle_make,
        vehicle_model,
        chassis_code,
        media_type,
        movie_title,
        movie_year,
        role_importance
      `)
      .in('media_type', mediaTypes)
      .not('generation_id', 'is', null)

    if (brand) {
      query = query.ilike('vehicle_make', `%${brand}%`)
    }

    const { data: appearances, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by generation and count
    const grouped = new Map<string, {
      generation_id: string
      brand: string
      model: string
      chassis_code: string | null
      movies: Set<string>
      games: Set<string>
      total: number
      star_roles: number
      titles: { title: string; year: number; type: string }[]
    }>()

    appearances?.forEach(app => {
      const key = app.generation_id!
      if (!grouped.has(key)) {
        grouped.set(key, {
          generation_id: key,
          brand: app.vehicle_make,
          model: app.vehicle_model,
          chassis_code: app.chassis_code,
          movies: new Set(),
          games: new Set(),
          total: 0,
          star_roles: 0,
          titles: []
        })
      }
      
      const entry = grouped.get(key)!
      entry.total++
      
      if (app.role_importance === 'star') {
        entry.star_roles++
      }
      
      if (app.media_type === 'video_game') {
        entry.games.add(app.movie_title)
      } else {
        entry.movies.add(app.movie_title)
      }
      
      // Keep top 5 appearances
      if (entry.titles.length < 5) {
        entry.titles.push({
          title: app.movie_title,
          year: app.movie_year || 0,
          type: app.media_type || 'movie'
        })
      }
    })

    // Convert to array and sort by total appearances
    const results = Array.from(grouped.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
      .map(entry => ({
        generation_id: entry.generation_id,
        brand: entry.brand,
        model: entry.model,
        generation: entry.chassis_code,
        stats: {
          total_appearances: entry.total,
          movies_count: entry.movies.size,
          games_count: entry.games.size,
          star_roles: entry.star_roles,
        },
        notable_titles: entry.titles.sort((a, b) => b.year - a.year)
      }))

    // Get summary stats
    const totalMovies = new Set(appearances?.filter(a => a.media_type !== 'video_game').map(a => a.movie_title)).size
    const totalGames = new Set(appearances?.filter(a => a.media_type === 'video_game').map(a => a.movie_title)).size

    return NextResponse.json({
      data: results,
      summary: {
        total_appearances: appearances?.length || 0,
        unique_movies: totalMovies,
        unique_games: totalGames,
        vehicles_count: results.length
      }
    })

  } catch (err) {
    console.error('Screen cars error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
