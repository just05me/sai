/**
 * POST /api/collab/token { projectId } → { token, expiresAt }
 *
 * Подписывает короткоживущий HS256-JWT для Hocuspocus с claims { uid, pid, exp }.
 * Сервер коллаборации не должен ходить в БД для аутентификации каждого WS-фрейма,
 * поэтому проверка членства происходит здесь.
 */
import { createHmac } from 'node:crypto';
import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { env } from '@/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TTL_SEC = 60 * 60; // 1 час, перевыпуск по реконнекту

function signCollabJwt(uid: string, pid: string): { token: string; expiresAt: number } {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const payload = Buffer.from(JSON.stringify({ uid, pid, exp })).toString('base64url');
  const sig = createHmac('sha256', env.AUTH_SECRET).update(`${header}.${payload}`).digest('base64url');
  return { token: `${header}.${payload}.${sig}`, expiresAt: exp * 1000 };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  let body: { projectId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (!body.projectId) return new Response('projectId required', { status: 400 });

  const project = await prisma.project.findUnique({
    where: { id: body.projectId },
    select: {
      workspace: { select: { members: { where: { userId: session.user.id }, select: { role: true } } } },
    },
  });
  if (!project || !project.workspace.members.length) {
    return new Response('Forbidden', { status: 403 });
  }

  return Response.json(signCollabJwt(session.user.id, body.projectId));
}
