import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 100
const RATE_WINDOW = 60 * 1000 // 1 minute

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0] || 'unknown'
}

function isRateLimited(key: string): { limited: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_WINDOW })
    return { limited: false, remaining: RATE_LIMIT - 1 }
  }

  record.count++
  if (record.count > RATE_LIMIT) {
    return { limited: true, remaining: 0 }
  }
  return { limited: false, remaining: RATE_LIMIT - record.count }
}

// Cache durations by endpoint
const CACHE_CONFIG: Record<string, number> = {
  '/api/brands': 3600,      // 1 hour
  '/api/vehicles': 300,     // 5 minutes  
  '/api/search': 60,        // 1 minute
  '/api/compare': 300,      // 5 minutes
  '/api/screen-cars': 3600, // 1 hour
  '/api/health': 0,         // no cache
}

function getCacheDuration(pathname: string): number {
  for (const [pattern, duration] of Object.entries(CACHE_CONFIG)) {
    if (pathname.startsWith(pattern)) return duration
  }
  return 60
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only apply to API routes
  if (!pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Skip rate limiting for health check
  if (pathname === '/api/health') {
    const response = NextResponse.next()
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
  }

  // Rate limiting
  const rateLimitKey = getRateLimitKey(request)
  const { limited, remaining } = isRateLimited(rateLimitKey)

  if (limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': '0',
          'Retry-After': '60',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }

  const response = NextResponse.next()

  // Rate limit headers
  response.headers.set('X-RateLimit-Limit', RATE_LIMIT.toString())
  response.headers.set('X-RateLimit-Remaining', remaining.toString())

  // CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')

  // Cache headers (GET only)
  if (request.method === 'GET') {
    const cacheDuration = getCacheDuration(pathname)
    if (cacheDuration > 0) {
      response.headers.set(
        'Cache-Control', 
        `public, s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`
      )
    }
  }

  return response
}

export const config = {
  matcher: '/api/:path*',
}
