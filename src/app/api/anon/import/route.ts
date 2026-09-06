/**
 * POST /api/anon/import { anonToken } → { projectId }
 *
 * Принимает anonToken от Quick Capture, проверяет, что AnonSession ещё жива,
 * создаёт проект в первом workspace юзера и разворачивает skeleton.
 */
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { MindMapService, type MindMapSkeleton } from '@/server/services/mindmap';
import { TreeKind } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ anonToken: z.string().min(8) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json(parsed.error.flatten(), { status: 400 });

  const anon = await prisma.anonSession.findUnique({ where: { token: parsed.data.anonToken } });
  if (!anon || anon.expiresAt < new Date()) {
    return Response.json({ error: 'EXPIRED' }, { status: 410 });
  }
  const data = anon.data as { idea?: string; skeleton?: MindMapSkeleton } | null;
  if (!data?.skeleton) return Response.json({ error: 'NO_SKELETON' }, { status: 400 });

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: 'asc' },
  });
  if (!member) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      workspaceId: member.workspaceId,
      name: data.idea?.slice(0, 60) ?? 'Quick Capture',
      description: data.idea,
      createdById: session.user.id,
    },
  });
  await prisma.tree.createMany({
    data: Object.values(TreeKind).map((kind) => ({ projectId: project.id, kind })),
  });
  await MindMapService.applySkeleton(project.id, data.skeleton);

  // Одноразовая сессия — удаляем после успешного импорта.
  await prisma.anonSession.delete({ where: { token: parsed.data.anonToken } });

  return Response.json({ projectId: project.id });
}
