/**
 * In-memory token-bucket rate limiter (Sai 1.0 selfhost).
 * Отдаёт заголовки X-RateLimit-* в GitHub-стиле.
 */

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowSec } = opts;
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSec / windowSec);
  const bucketKey = `rl:${key}:${windowStart}`;
  const resetAtMs = (windowStart + 1) * windowSec * 1000;

  const existing = buckets.get(bucketKey);
  const count = (existing?.count ?? 0) + 1;
  buckets.set(bucketKey, { count, resetAt: resetAtMs });

  const remaining = Math.max(0, limit - count);
  return {
    ok: count <= limit,
    limit,
    remaining,
    resetAt: new Date(resetAtMs),
  };
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(Math.floor(r.resetAt.getTime() / 1000)),
  };
}
