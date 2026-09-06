/**
 * Простой Redis token-bucket rate limiter.
 *  - Используется для auth endpoints (5 r/min) и публичного API (план-зависимо).
 *  - Отдаёт заголовки X-RateLimit-* совместимые с GitHub-стилем.
 *  - Sai 1.0 selfhost: если Redis недоступен, fail-open (пропускаем запрос).
 */
import { redis } from './redis';

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowSec } = opts;
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSec / windowSec);
  const redisKey = `rl:${key}:${windowStart}`;

  try {
    const tx = redis.multi();
    tx.incr(redisKey);
    tx.expire(redisKey, windowSec);
    const [[, currentRaw]] = (await tx.exec()) as [[Error | null, number]];
    const current = Number(currentRaw);
    const remaining = Math.max(0, limit - current);
    const resetAt = new Date((windowStart + 1) * windowSec * 1000);
    return { ok: current <= limit, limit, remaining, resetAt };
  } catch {
    // Redis недоступен (selfhost без Redis) — fail-open.
    return { ok: true, limit, remaining: limit, resetAt: new Date(Date.now() + windowSec * 1000) };
  }
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(Math.floor(r.resetAt.getTime() / 1000)),
  };
}
