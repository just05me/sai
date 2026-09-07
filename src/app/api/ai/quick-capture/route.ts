/**
 * Quick Capture — публичный endpoint, доступен без логина.
 * Создаёт анонимную сессию + проект-черновик с skeleton.
 *
 * Если у анонима нет BYOK — возвращаем 402 с предложением залогиниться/настроить ключ.
 * В демо-режиме (например, self-host без ключей) — возвращаем mock skeleton.
 */
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { rateLimit, rateLimitHeaders } from '@/server/ratelimit';
import { MindMapService } from '@/server/services/mindmap';
import { ProviderError } from '@/server/services/provider-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ idea: z.string().min(3).max(500) });

const MOCK_SKELETON = {
  trees: [
    {
      kind: 'DEV' as const,
      root: { title: 'Архитектура', description: 'Стек и инфраструктура продукта' },
      children: [
        { title: 'Frontend', description: 'Next.js + React 19' },
        { title: 'Backend', description: 'Node.js + PostgreSQL' },
        { title: 'AI слой', description: 'Vercel AI SDK с BYOK' },
      ],
    },
    {
      kind: 'FUNC' as const,
      root: { title: 'Ключевой UX', description: 'Что пользователь делает первым' },
      children: [
        { title: 'Онбординг', description: 'Карта за 3 минуты' },
        { title: 'Канвас', description: 'Три дерева, mind map view' },
        { title: 'AI-чат', description: 'Поговорить с проектом' },
      ],
    },
    {
      kind: 'BIZ' as const,
      root: { title: 'Монетизация', description: 'BYOK без наценки на токены' },
      children: [
        { title: 'Free / Pro / Team', description: 'Лимиты по узлам и фичам' },
        { title: 'Self-host лицензия', description: 'Для корпоративных клиентов' },
        { title: 'Public Explore', description: 'SEO + органический growth' },
      ],
    },
  ],
};

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? 'anon').split(',')[0]!.trim() || 'anon';
  const rl = await rateLimit({ key: `qc:${ip}`, limit: 6, windowSec: 600 });
  if (!rl.ok) {
    return Response.json(
      { error: 'RATE_LIMIT', message: 'Слишком много попыток. Попробуй позже.' },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 });

  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  let skeleton: Awaited<ReturnType<typeof MindMapService.generateFromIdea>> | typeof MOCK_SKELETON;

  // Локальный пользователь: генерируем по его BYOK-ключу, а если ключа нет —
  // отдаём mock-скелет, чтобы Quick Capture работал «из коробки».
  const member = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
  });
  try {
    if (!member) throw new ProviderError('NO_KEY', 'no workspace');
    skeleton = await MindMapService.generateFromIdea({
      workspaceId: member.workspaceId,
      userId: session.user.id,
      idea: parsed.data.idea,
    });
  } catch (e) {
    if (e instanceof ProviderError && e.code === 'NO_KEY') {
      // ВАЖНО: deep-clone, иначе мутация description утечёт между запросами.
      skeleton = structuredClone(MOCK_SKELETON);
      skeleton.trees[0].root.description = parsed.data.idea.slice(0, 150);
    } else {
      throw e;
    }
  }

  // F-110 — анонимная сессия 24 часа
  const anonToken = nanoid(32);
  await prisma.anonSession.create({
    data: {
      token: anonToken,
      data: { idea: parsed.data.idea, skeleton } as object,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });

  return Response.json({ anonToken, skeleton }, { headers: rateLimitHeaders(rl) });
}
