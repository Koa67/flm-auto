import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { apiLimiter } from "@/lib/rate-limit";

const RATE_LIMIT = 100;

const ALLOWED_ORIGINS = [
  "https://flm-auto.vercel.app",
  "https://flm-auto.fr",
  "http://localhost:3000",
];

const PROTECTED_ROUTES = ["/dashboard", "/garage", "/alertes"];

function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
}

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

// Cache durations by endpoint
const CACHE_CONFIG: Record<string, number> = {
  "/api/brands": 3600,
  "/api/vehicles": 300,
  "/api/search": 60,
  "/api/compare": 300,
  "/api/screen-cars": 3600,
  "/api/ux-score": 3600,
  "/api/trims": 3600,
  "/api/cargo": 3600,
  "/api/family-fit": 3600,
  "/api/seats": 3600,
  "/api/dimensions": 3600,
  "/api/recommend": 300,
  "/api/stats": 3600,
  "/api/blueprints": 3600,
  "/api/recalls": 3600,
  "/api/configurateur": 300,
  "/api/health": 0,
  "/api/alain": 0,
  "/api/newsletter": 0,
  "/api/price-alerts": 0,
  "/api/wishlist": 0,
  "/api/saved-comparisons": 0,
  "/api/saved-searches": 0,
};

function getCacheDuration(pathname: string): number {
  for (const [pattern, duration] of Object.entries(CACHE_CONFIG)) {
    if (pathname.startsWith(pattern)) return duration;
  }
  return 60;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // For API routes: apply CORS, rate limiting, caching (no auth session needed)
  if (pathname.startsWith("/api")) {
    const origin = getAllowedOrigin(request);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Skip rate limiting for health check
    if (pathname === "/api/health") {
      const response = NextResponse.next();
      response.headers.set("Access-Control-Allow-Origin", origin);
      return response;
    }

    // Rate limiting (LRU-based)
    const rateLimitKey = getRateLimitKey(request);
    const { success, remaining, reset } = apiLimiter.check(rateLimitKey);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": RATE_LIMIT.toString(),
            "X-RateLimit-Remaining": "0",
            "Retry-After": String(reset),
            "Access-Control-Allow-Origin": origin,
          },
        }
      );
    }

    const response = NextResponse.next();

    response.headers.set("X-RateLimit-Limit", RATE_LIMIT.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    if (request.method === "GET") {
      const cacheDuration = getCacheDuration(pathname);
      if (cacheDuration > 0) {
        response.headers.set(
          "Cache-Control",
          `public, s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`
        );
      }
    }

    return response;
  }

  // For page routes: refresh auth session + protect routes
  const { supabaseResponse, user } = await updateSession(request);

  // Check protected routes
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected && !user) {
    const redirectUrl = new URL("/connexion", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/garage/:path*",
    "/alertes/:path*",
    "/connexion",
    "/auth/callback",
  ],
};
