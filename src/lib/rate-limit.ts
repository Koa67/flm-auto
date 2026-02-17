import { LRUCache } from "lru-cache";

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export function createRateLimiter(opts: {
  interval: number;
  maxRequests: number;
}) {
  const cache = new LRUCache<string, number[]>({
    max: 10000,
    ttl: opts.interval,
  });

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const windowStart = now - opts.interval;
      let requests = cache.get(key) || [];
      requests = requests.filter((t) => t > windowStart);

      const remaining = opts.maxRequests - requests.length;
      const reset =
        requests.length > 0
          ? Math.ceil((requests[0] + opts.interval - now) / 1000)
          : 0;

      if (requests.length >= opts.maxRequests) {
        return { success: false, remaining: 0, reset };
      }

      requests.push(now);
      cache.set(key, requests);
      return { success: true, remaining: remaining - 1, reset };
    },
  };
}

// Pre-configured limiters
export const apiLimiter = createRateLimiter({
  interval: 60_000,
  maxRequests: 100,
});

export const authLimiter = createRateLimiter({
  interval: 15 * 60_000,
  maxRequests: 10,
});

export const searchLimiter = createRateLimiter({
  interval: 60_000,
  maxRequests: 30,
});
