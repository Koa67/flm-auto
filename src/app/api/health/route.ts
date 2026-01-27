import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { HealthStatus } from '@/types/api'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const VERSION = '1.0.0'

export async function GET() {
  const start = Date.now()
  
  try {
    const { count: genCount, error } = await supabase
      .from('generations')
      .select('*', { count: 'exact', head: true })

    const dbLatency = Date.now() - start

    if (error) {
      const response: HealthStatus = {
        status: 'degraded',
        version: VERSION,
        timestamp: new Date().toISOString(),
        database: { connected: false, latency_ms: dbLatency },
        stats: { generations: 0, variants: 0, appearances: 0 },
      }
      return NextResponse.json(response, { status: 503 })
    }

    const { count: variantCount } = await supabase
      .from('engine_variants')
      .select('*', { count: 'exact', head: true })

    const { count: appearanceCount } = await supabase
      .from('vehicle_appearances')
      .select('*', { count: 'exact', head: true })

    const response: HealthStatus = {
      status: 'ok',
      version: VERSION,
      timestamp: new Date().toISOString(),
      database: { connected: true, latency_ms: dbLatency },
      stats: {
        generations: genCount || 0,
        variants: variantCount || 0,
        appearances: appearanceCount || 0,
      },
    }

    return NextResponse.json(response)

  } catch {
    const response: HealthStatus = {
      status: 'down',
      version: VERSION,
      timestamp: new Date().toISOString(),
      database: { connected: false, latency_ms: Date.now() - start },
      stats: { generations: 0, variants: 0, appearances: 0 },
    }
    return NextResponse.json(response, { status: 503 })
  }
}
