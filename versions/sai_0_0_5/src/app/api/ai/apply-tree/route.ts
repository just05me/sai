/**
 * Применяет предложенное AI дерево на холст с выбранным режимом мутации.
 * Вызывается из GlobalChat после подтверждения пользователем.
 */
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { MutationService, type TreeSpec } from '@/server/services/mutation';

const leafSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});
const midSchema = leafSchema.extend({
  children: z.array(leafSchema).max(8).optional(),
});
const rootSchema = leafSchema.extend({
  children: z.array(midSchema).max(8).optional(),
});

const schema = z.object({
  workspaceId: z.string(),
  projectId: z.string(),
  treeKind: z.enum(['DEV', 'FUNC', 'BIZ']),
  mutationMode: z.enum(['append', 'replace_subtree', 'replace_tree', 'rewrite_all']),
  parentNodeId: z.string().nullable().optional(),
  replaceAtNodeId: z.string().nullable().optional(),
  root: rootSchema,
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const body = schema.safeParse(await req.json());
  if (!body.success) return Response.json(body.error.flatten(), { status: 400 });

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: body.data.workspaceId, userId: session.user.id } },
  });
  if (!member) return new Response('Forbidden', { status: 403 });

  try {
    const res = await MutationService.buildTree({
      workspaceId: body.data.workspaceId,
      userId: session.user.id,
      projectId: body.data.projectId,
      treeKind: body.data.treeKind,
      root: body.data.root as TreeSpec,
      parentNodeId: body.data.parentNodeId ?? null,
      replaceAtNodeId: body.data.replaceAtNodeId ?? null,
      mutationMode: body.data.mutationMode,
    });
    return Response.json({ ok: true, ...res });
  } catch (e) {
    return Response.json(
      { ok: false, message: e instanceof Error ? e.message : 'Не удалось применить дерево' },
      { status: 400 },
    );
  }
}
