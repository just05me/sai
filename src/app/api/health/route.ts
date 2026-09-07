/**
 * GET /api/health — health-check для selfhost (Postgres only).
 */
import { prisma } from '@/server/prisma';

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

  const ok = Object.values(checks).every((c) => c.ok);
  return Response.json(
    { ok, mode: 'selfhost', version: '1.0.0', checks, time: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
