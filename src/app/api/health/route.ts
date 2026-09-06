/**
 * GET /api/health — детальный health-check (NFR §11.2).
 */
import { prisma } from '@/server/prisma';
import { redis } from '@/server/redis';
import { env } from '@/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  const tDb = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latencyMs: Date.now() - tDb };
  } catch (e) {
    checks.database = { ok: false, error: String(e) };
  }

  // Redis не требуется в selfhost-режиме Sai 1.0.
  if (env.SAI_MODE === 'cloud') {
    const tRedis = Date.now();
    try {
      await redis.ping();
      checks.redis = { ok: true, latencyMs: Date.now() - tRedis };
    } catch (e) {
      checks.redis = { ok: false, error: String(e) };
    }
  }

  const ok = Object.values(checks).every((c) => c.ok);
  return Response.json(
    { ok, mode: env.SAI_MODE, version: '1.0', checks, time: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
