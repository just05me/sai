/**
 * POST /api/ai/mutate
 * action ∈ expand | refactor | bridge | score
 * Возвращает preview. Применение — отдельным tRPC nodes.bulkInsert / edges.create.
 */
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { MutationService } from '@/server/services/mutation';
import { ProviderError } from '@/server/services/provider-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('expand'), workspaceId: z.string(), nodeId: z.string() }),
  z.object({ action: z.literal('refactor'), workspaceId: z.string(), nodeIds: z.array(z.string()).min(1).max(50) }),
  z.object({ action: z.literal('bridge'), workspaceId: z.string(), nodeId: z.string() }),
  z.object({ action: z.literal('score'), workspaceId: z.string(), projectId: z.string() }),
]);

async function ensureMember(workspaceId: string, userId: string): Promise<boolean> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  return !!member;
}

async function ensureNodesInWorkspace(nodeIds: string[], workspaceId: string): Promise<boolean> {
  const nodes = await prisma.node.findMany({
    where: { id: { in: nodeIds } },
    select: { project: { select: { workspaceId: true } } },
  });
  return nodes.length === new Set(nodeIds).size && nodes.every((n) => n.project.workspaceId === workspaceId);
}

async function ensureProjectInWorkspace(projectId: string, workspaceId: string): Promise<boolean> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  return !!p && p.workspaceId === workspaceId;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const body = schema.safeParse(json);
  if (!body.success) return Response.json(body.error.flatten(), { status: 400 });

  const userId = session.user.id;
  if (!(await ensureMember(body.data.workspaceId, userId))) {
    return new Response('Forbidden', { status: 403 });
  }
  switch (body.data.action) {
    case 'expand':
    case 'bridge':
      if (!(await ensureNodesInWorkspace([body.data.nodeId], body.data.workspaceId))) {
        return new Response('Forbidden', { status: 403 });
      }
      break;
    case 'refactor':
      if (!(await ensureNodesInWorkspace(body.data.nodeIds, body.data.workspaceId))) {
        return new Response('Forbidden', { status: 403 });
      }
      break;
    case 'score':
      if (!(await ensureProjectInWorkspace(body.data.projectId, body.data.workspaceId))) {
        return new Response('Forbidden', { status: 403 });
      }
      break;
  }

  try {
    switch (body.data.action) {
      case 'expand':
        return Response.json(await MutationService.expand({ workspaceId: body.data.workspaceId, userId, nodeId: body.data.nodeId }));
      case 'refactor':
        return Response.json(await MutationService.refactor({ workspaceId: body.data.workspaceId, userId, nodeIds: body.data.nodeIds }));
      case 'bridge':
        return Response.json(await MutationService.bridgeSuggest({ workspaceId: body.data.workspaceId, userId, nodeId: body.data.nodeId }));
      case 'score':
        return Response.json(await MutationService.ideaScore({ workspaceId: body.data.workspaceId, userId, projectId: body.data.projectId }));
    }
  } catch (e) {
    if (e instanceof ProviderError) {
      return Response.json({ error: e.code, message: e.message }, { status: 402 });
    }
    console.error('[ai/mutate]', e);
    return Response.json({ error: 'UNKNOWN', message: String(e) }, { status: 500 });
  }
}
