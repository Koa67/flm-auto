import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ENGINE_RED_FLAGS } from '@/types/vehicle'
import { logError } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfigurateurCriteria {
  // Budget
  budget_min?: number
  budget_max?: number
  achat_type?: 'neuf' | 'occasion' | 'les_deux'

  // Famille
  passagers?: number       // 2 | 4 | 5 | 7 | 9
  child_seats?: number     // 0-3
  three_across?: boolean

  // Usage
  usage?: string[]         // ville | route | autoroute | tout_terrain

  // Motorisation
  fuel_types?: string[]
  power_min?: number
  power_max?: number
  exclude_red_flags?: boolean

  // Coffre
  cargo_min?: number       // liters

  // Confort / UX
  ux_score_min?: number
  physical_buttons?: boolean
  wireless_carplay?: boolean
  ncap_min?: number        // 1-5

  // Priorites (ordered list)
  priorities?: string[]    // prix | conso | espace | fiabilite | confort | securite

  // Pagination
  limit?: number
}

interface VehicleResult {
  generation_id: string
  brand: string
  brand_slug: string
  model: string
  model_slug: string
  generation: string
  generation_slug: string
  year_start: number | null
  year_end: number | null
  score: number
  thumbnail: string | null
  red_flag_count?: number
  specs: {
    power_hp: number | null
    fuel_type: string | null
    trunk_volume_liters: number | null
    ncap_rating: number | null
    ux_score: number | null
    consumption_l100km: number | null
    tuv_defect_rate: number | null
  }
}

// ---------------------------------------------------------------------------
// Red flag matching helper
// ---------------------------------------------------------------------------

function matchRedFlags(engineCodes: string[]): number {
  const matched = new Set<string>()
  for (const code of engineCodes) {
    for (const [key, flag] of Object.entries(ENGINE_RED_FLAGS)) {
      if (matched.has(key)) continue
      if (flag.patterns.some((p) => code.toUpperCase().includes(p.toUpperCase()))) {
        matched.add(key)
      }
    }
  }
  return matched.size
}

// ---------------------------------------------------------------------------
// POST /api/configurateur/search
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: ConfigurateurCriteria = await request.json()
    const limit = Math.min(body.limit || 30, 100)

    // -----------------------------------------------------------------------
    // Step 1: Fetch engine_variants with powertrain_specs + engine_code
    // -----------------------------------------------------------------------
    interface EngineRow {
      id: string
      generation_id: string
      name: string
      engine_code: string | null
      fuel_type: string | null
      powertrain_specs: { power_hp: number | null }[] | null
    }

    const PAGE = 1000
    let evOffset = 0
    const allVariants: EngineRow[] = []

    while (true) {
      let q = supabase
        .from('engine_variants')
        .select('id, generation_id, name, engine_code, fuel_type, powertrain_specs(power_hp)')

      if (body.fuel_types && body.fuel_types.length > 0) {
        q = q.in('fuel_type', body.fuel_types)
      }

      q = q.range(evOffset, evOffset + PAGE - 1)
      const { data, error } = await q
      if (error) {
        logError(error, { endpoint: '/api/configurateur/search' })
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
      }
      if (!data || data.length === 0) break
      allVariants.push(...(data as unknown as EngineRow[]))
      if (data.length < PAGE) break
      evOffset += PAGE
    }

    // Build maps: generation_id -> best variant + all engine codes for red flag matching
    const genMap = new Map<string, { power_hp: number | null; fuel_type: string | null; name: string }>()
    const genEngineCodes = new Map<string, string[]>()

    for (const v of allVariants) {
      const pt = Array.isArray(v.powertrain_specs) ? v.powertrain_specs[0] : null
      const power = pt?.power_hp ?? null

      // Apply power filters
      if (body.power_min && (power === null || power < body.power_min)) continue
      if (body.power_max && power !== null && power > body.power_max) continue

      const existing = genMap.get(v.generation_id)
      if (!existing || (power ?? 0) > (existing.power_hp ?? 0)) {
        genMap.set(v.generation_id, {
          power_hp: power,
          fuel_type: v.fuel_type,
          name: v.name,
        })
      }

      // Collect engine codes for red flag matching
      if (v.engine_code) {
        const codes = genEngineCodes.get(v.generation_id) || []
        codes.push(v.engine_code)
        genEngineCodes.set(v.generation_id, codes)
      }
      // Also check variant name for engine codes
      if (v.name) {
        const codes = genEngineCodes.get(v.generation_id) || []
        codes.push(v.name)
        genEngineCodes.set(v.generation_id, codes)
      }
    }

    // Red flag filtering: exclude generations with critical/major red flags
    if (body.exclude_red_flags) {
      for (const [genId, codes] of genEngineCodes) {
        const flagCount = matchRedFlags(codes)
        if (flagCount > 0) {
          genMap.delete(genId)
        }
      }
    }

    const genIds = Array.from(genMap.keys())
    if (genIds.length === 0) {
      return NextResponse.json({ results: [], total: 0 })
    }

    // -----------------------------------------------------------------------
    // Step 2: Fetch generations with model/brand info
    // -----------------------------------------------------------------------
    interface GenRow {
      id: string
      name: string
      slug: string
      production_start: string | null
      production_end: string | null
      models: {
        id: string
        name: string
        slug: string
        brands: {
          id: string
          name: string
          slug: string
        }
      }
    }

    const batchSize = 500
    const allGens: GenRow[] = []

    for (let i = 0; i < genIds.length; i += batchSize) {
      const batch = genIds.slice(i, i + batchSize)
      const { data, error } = await supabase
        .from('generations')
        .select(`
          id,
          name,
          slug,
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
        .in('id', batch)

      if (error) {
        logError(error, { endpoint: '/api/configurateur/search' })
        continue
      }
      if (data) allGens.push(...(data as unknown as GenRow[]))
    }

    // -----------------------------------------------------------------------
    // Step 3: Fetch interior_dimensions for trunk volume
    // -----------------------------------------------------------------------
    interface DimRow {
      generation_id: string
      trunk_volume_liters: number | null
      trunk_volume_max_liters: number | null
    }
    const dimMap = new Map<string, DimRow>()

    for (let i = 0; i < genIds.length; i += batchSize) {
      const batch = genIds.slice(i, i + batchSize)
      const { data } = await supabase
        .from('interior_dimensions')
        .select('generation_id, trunk_volume_liters, trunk_volume_max_liters')
        .in('generation_id', batch)

      if (data) {
        for (const d of data as DimRow[]) {
          dimMap.set(d.generation_id, d)
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 4: Fetch safety_ratings
    // -----------------------------------------------------------------------
    interface SafetyRow {
      generation_id: string
      overall_rating: number | null
    }
    const safetyMap = new Map<string, number>()

    for (let i = 0; i < genIds.length; i += batchSize) {
      const batch = genIds.slice(i, i + batchSize)
      const { data } = await supabase
        .from('safety_ratings')
        .select('generation_id, overall_rating')
        .in('generation_id', batch)

      if (data) {
        for (const s of data as SafetyRow[]) {
          if (s.overall_rating != null) {
            safetyMap.set(s.generation_id, s.overall_rating)
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 5: Fetch ux_ratings (if relevant criteria)
    // -----------------------------------------------------------------------
    interface UxRow {
      generation_id: string
      overall_ux_score: number | null
      physical_buttons_climate: number | null
      wireless_carplay: boolean | null
    }
    const uxMap = new Map<string, UxRow>()

    const needUx = body.ux_score_min || body.physical_buttons || body.wireless_carplay
    if (needUx) {
      for (let i = 0; i < genIds.length; i += batchSize) {
        const batch = genIds.slice(i, i + batchSize)
        const { data } = await supabase
          .from('ux_ratings')
          .select('generation_id, overall_ux_score, physical_buttons_climate, wireless_carplay')
          .in('generation_id', batch)

        if (data) {
          for (const u of data as UxRow[]) {
            uxMap.set(u.generation_id, u)
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 6: Fetch real consumption + TÜV defect rates from third_party_specs
    // -----------------------------------------------------------------------
    const consumptionMap = new Map<string, number>()
    const tuvMap = new Map<string, number>()

    const needConso = body.priorities?.includes('conso')
    const needFiabilite = body.priorities?.includes('fiabilite')

    if (needConso || needFiabilite) {
      for (let i = 0; i < genIds.length; i += batchSize) {
        const batch = genIds.slice(i, i + batchSize)
        const { data } = await supabase
          .from('third_party_specs')
          .select('generation_id, spec_type, spec_value')
          .in('generation_id', batch)
          .or('spec_type.like.consumption%,spec_type.like.spritmonitor%,spec_type.like.tuv_defect_rate%')

        if (data) {
          for (const row of data as { generation_id: string; spec_type: string; spec_value: string }[]) {
            const val = parseFloat(row.spec_value)
            if (isNaN(val)) continue

            if (row.spec_type.startsWith('consumption') || row.spec_type.startsWith('spritmonitor')) {
              if (!consumptionMap.has(row.generation_id) || val < consumptionMap.get(row.generation_id)!) {
                consumptionMap.set(row.generation_id, val)
              }
            } else if (row.spec_type.startsWith('tuv_defect_rate')) {
              // Use the lowest age bracket available (best representation)
              if (!tuvMap.has(row.generation_id) || val < tuvMap.get(row.generation_id)!) {
                tuvMap.set(row.generation_id, val)
              }
            }
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 7: Fetch one thumbnail per generation
    // -----------------------------------------------------------------------
    const thumbMap = new Map<string, string>()

    for (let i = 0; i < genIds.length; i += batchSize) {
      const batch = genIds.slice(i, i + batchSize)
      const { data } = await supabase
        .from('vehicle_images')
        .select('generation_id, url')
        .in('generation_id', batch)
        .limit(1)

      if (data) {
        for (const img of data as { generation_id: string; url: string }[]) {
          if (!thumbMap.has(img.generation_id)) {
            thumbMap.set(img.generation_id, img.url)
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 8: Post-filter & Score
    // -----------------------------------------------------------------------
    const candidates: VehicleResult[] = []

    for (const gen of allGens) {
      const variant = genMap.get(gen.id)
      if (!variant) continue

      const dim = dimMap.get(gen.id)
      const safety = safetyMap.get(gen.id) ?? null
      const ux = uxMap.get(gen.id) ?? null
      const consumption = consumptionMap.get(gen.id) ?? null
      const tuvDefect = tuvMap.get(gen.id) ?? null

      // Filter: cargo_min
      if (body.cargo_min && body.cargo_min > 0) {
        const trunk = dim?.trunk_volume_liters ?? 0
        if (trunk < body.cargo_min) continue
      }

      // Filter: ncap_min
      if (body.ncap_min && body.ncap_min > 0) {
        if (safety === null || safety < body.ncap_min) continue
      }

      // Filter: ux_score_min
      if (body.ux_score_min && body.ux_score_min > 0) {
        const uxScore = ux?.overall_ux_score ?? 0
        if (uxScore < body.ux_score_min) continue
      }

      // Filter: physical_buttons
      if (body.physical_buttons) {
        const pbc = ux?.physical_buttons_climate ?? 0
        if (pbc < 7) continue
      }

      // Filter: wireless_carplay
      if (body.wireless_carplay) {
        if (!ux?.wireless_carplay) continue
      }

      // Extract year range
      const yearStart = gen.production_start
        ? new Date(gen.production_start).getFullYear()
        : null
      const yearEnd = gen.production_end
        ? new Date(gen.production_end).getFullYear()
        : null

      // Red flag count (for display even if not excluding)
      const engineCodes = genEngineCodes.get(gen.id) || []
      const redFlagCount = engineCodes.length > 0 ? matchRedFlags(engineCodes) : 0

      // Compute relevance score based on priorities
      const score = computeScore(body.priorities || [], {
        power_hp: variant.power_hp,
        trunk: dim?.trunk_volume_liters ?? null,
        safety,
        uxScore: ux?.overall_ux_score ?? null,
        consumption,
        tuvDefectRate: tuvDefect,
        redFlagCount,
      })

      const model = gen.models as unknown as {
        id: string; name: string; slug: string;
        brands: { id: string; name: string; slug: string }
      }

      candidates.push({
        generation_id: gen.id,
        brand: model.brands.name,
        brand_slug: model.brands.slug,
        model: model.name,
        model_slug: model.slug,
        generation: gen.name,
        generation_slug: gen.slug,
        year_start: yearStart,
        year_end: yearEnd,
        score,
        thumbnail: thumbMap.get(gen.id) || null,
        red_flag_count: redFlagCount,
        specs: {
          power_hp: variant.power_hp,
          fuel_type: variant.fuel_type,
          trunk_volume_liters: dim?.trunk_volume_liters ?? null,
          ncap_rating: safety,
          ux_score: ux?.overall_ux_score ?? null,
          consumption_l100km: consumption,
          tuv_defect_rate: tuvDefect,
        },
      })
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score)

    return NextResponse.json({
      results: candidates.slice(0, limit),
      total: candidates.length,
    })
  } catch (err) {
    logError(err, { endpoint: '/api/configurateur/search' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Scoring function based on user priorities (enriched with conso + fiabilite)
// ---------------------------------------------------------------------------

function computeScore(
  priorities: string[],
  data: {
    power_hp: number | null
    trunk: number | null
    safety: number | null
    uxScore: number | null
    consumption: number | null
    tuvDefectRate: number | null
    redFlagCount: number
  }
): number {
  // Default weights when no priorities given
  const defaultWeights: Record<string, number> = {
    prix: 1,
    conso: 1,
    espace: 1,
    fiabilite: 1,
    confort: 1,
    securite: 1,
  }

  // If priorities are provided, weight by position (first = most important)
  const weights: Record<string, number> = {}
  if (priorities.length > 0) {
    priorities.forEach((p, i) => {
      weights[p] = priorities.length - i // e.g. 6,5,4,3,2,1
    })
  } else {
    Object.assign(weights, defaultWeights)
  }

  let score = 50 // base score

  // Espace: trunk volume
  if (weights.espace && data.trunk) {
    const trunkScore = Math.min(data.trunk / 700, 1) * 10
    score += trunkScore * (weights.espace || 1)
  }

  // Securite: NCAP rating
  if (weights.securite && data.safety) {
    score += (data.safety / 5) * 10 * (weights.securite || 1)
  }

  // Confort: UX score
  if (weights.confort && data.uxScore) {
    score += (data.uxScore / 100) * 10 * (weights.confort || 1)
  }

  // Consommation: lower is better (4L/100km = excellent, 10L = poor)
  if (weights.conso && data.consumption) {
    const consoScore = Math.max(0, 10 - (data.consumption - 4) * 1.5)
    score += consoScore * (weights.conso || 1)
  }

  // Fiabilite: TÜV defect rate (lower = better) + red flag penalty
  if (weights.fiabilite) {
    if (data.tuvDefectRate != null) {
      // 3% = excellent (10pts), 10% = average (5pts), 20%+ = poor (0pts)
      const tuvScore = Math.max(0, 10 - (data.tuvDefectRate - 3) * 0.6)
      score += tuvScore * (weights.fiabilite || 1)
    }
    // Penalty for red flags
    if (data.redFlagCount > 0) {
      score -= data.redFlagCount * 3 * (weights.fiabilite || 1)
    }
  }

  // Power is a bonus for general interest
  if (data.power_hp) {
    score += Math.min(data.power_hp / 500, 1) * 5
  }

  return Math.round(score)
}
