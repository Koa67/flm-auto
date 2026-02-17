/**
 * Simple in-memory LRU cache with TTL
 * Used for API route caching to reduce Supabase queries
 * Can be upgraded to Upstash Redis later
 */

class LRUCache<T> {
  private cache = new Map<string, { value: T; expires: number }>();
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { value, expires: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// Singleton cache instance shared across API routes
export const apiCache = new LRUCache(500);

// Helper: cached fetch pattern
export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = apiCache.get(key) as T | null;
  if (cached !== null) return cached;

  const data = await fetcher();
  apiCache.set(key, data, ttlMs);
  return data;
}
