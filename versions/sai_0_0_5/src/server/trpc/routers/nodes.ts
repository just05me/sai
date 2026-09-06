import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  router,
  workspaceProcedure,
  assertProjectInWorkspace,
  assertNodeInWorkspace,
} from '../trpc';

export const nodeStatusSchema = z.enum(['IDEA', 'IN_PROGRESS', 'DONE', 'BLOCKED']);
export const hypothesisStatusSchema = z.enum([
  'NONE',
  'UNTESTED',
  'TESTING',
  'VALIDATED',
  'INVALIDATED',
]);

const positionSchema = z.object({ x: z.number(), y: z.number() });

export const nodesRouter = router({
  byProject: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      const nodes = await ctx.prisma.node.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { tree: { select: { kind: true } } },
      });
      // Сплющиваем — на клиент уходит treeKind как поле верхнего уровня.
      return nodes.map(({ tree, ...n }) => ({ ...n, treeKind: tree.kind }));
    }),

  create: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      projectId: z.string(),
      treeKind: z.enum(['DEV', 'FUNC', 'BIZ']),
      parentId: z.string().nullable().optional(),
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      position: positionSchema.optional(),
      origin: z.object({
        type: z.enum(['manual', 'ai_generate', 'ai_expand', 'ai_deepen', 'template', 'import']),
        prompt_hash: z.string().optional(),
        parent_chat_id: z.string().optional(),
      }).default({ type: 'manual' }),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      const tree = await ctx.prisma.tree.findUniqueOrThrow({
        where: { projectId_kind: { projectId: input.projectId, kind: input.treeKind } },
      });
      if (input.parentId) {
        const parent = await ctx.prisma.node.findUnique({
          where: { id: input.parentId },
          select: { projectId: true },
        });
        if (!parent || parent.projectId !== input.projectId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'parent in another project' });
        }
      }
      const node = await ctx.prisma.node.create({
        data: {
          projectId: input.projectId,
          treeId: tree.id,
          parentId: input.parentId ?? null,
          title: input.title,
          description: input.description,
          position: input.position ?? { x: 0, y: 0 },
          origin: { ...input.origin, created_at: new Date().toISOString() },
        },
      });
      if (input.parentId) {
        await ctx.prisma.edge.create({
          data: {
            projectId: input.projectId,
            sourceId: input.parentId,
            targetId: node.id,
            kind: 'PARENT_CHILD',
          },
        });
      } else if (!tree.rootId) {
        await ctx.prisma.tree.update({ where: { id: tree.id }, data: { rootId: node.id } });
      }
      return node;
    }),

  update: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      id: z.string(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: nodeStatusSchema.optional(),
      hypothesisStatus: hypothesisStatusSchema.optional(),
      assigneeId: z.string().nullable().optional(),
      position: positionSchema.optional(),
      collapsed: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, workspaceId: _ws, ...patch } = input;
      await assertNodeInWorkspace(ctx.prisma, id, ctx.workspaceId);
      const before = await ctx.prisma.node.findUniqueOrThrow({ where: { id } });
      const after = await ctx.prisma.node.update({
        where: { id },
        data: patch,
      });
      // F-225: ведём декларативный history (минимальный diff)
      await ctx.prisma.nodeHistory.create({
        data: {
          nodeId: id,
          source: 'user',
          authorId: ctx.user.id,
          diff: Object.fromEntries(
            Object.entries(patch).map(([k, v]) => [k, { from: (before as any)[k], to: v }]),
          ),
        },
      });
      return after;
    }),

  delete: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertNodeInWorkspace(ctx.prisma, input.id, ctx.workspaceId);
      await ctx.prisma.edge.deleteMany({
        where: {
          OR: [{ sourceId: input.id }, { targetId: input.id }],
        },
      });
      return ctx.prisma.node.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),

  bulkInsert: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      projectId: z.string(),
      nodes: z.array(z.object({
        treeKind: z.enum(['DEV', 'FUNC', 'BIZ']),
        parentId: z.string().nullable(),
        title: z.string(),
        description: z.string().optional(),
        position: positionSchema.optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.nodes.length > 50) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Max 50 nodes per batch' });
      }
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      // Все parentId должны лежать в том же projectId.
      const parentIds = input.nodes
        .map((n) => n.parentId)
        .filter((v): v is string => !!v);
      if (parentIds.length) {
        const parents = await ctx.prisma.node.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, projectId: true },
        });
        const wrong = parents.find((p) => p.projectId !== input.projectId);
        if (wrong || parents.length !== new Set(parentIds).size) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'parent in another project' });
        }
      }
      // Деревья проекта грузим один раз (а не на каждый узел) — убирает N+1.
      const kinds = Array.from(new Set(input.nodes.map((n) => n.treeKind)));
      const trees = await ctx.prisma.tree.findMany({
        where: { projectId: input.projectId, kind: { in: kinds } },
      });
      const treeByKind = new Map(trees.map((t) => [t.kind, t] as const));
      for (const kind of kinds) {
        if (!treeByKind.has(kind)) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `tree ${kind} not found` });
        }
      }
      const created = [];
      for (const n of input.nodes) {
        const tree = treeByKind.get(n.treeKind)!;
        const created_node = await ctx.prisma.node.create({
          data: {
            projectId: input.projectId,
            treeId: tree.id,
            parentId: n.parentId,
            title: n.title,
            description: n.description,
            position: n.position ?? { x: 0, y: 0 },
            origin: { type: 'ai_expand', created_at: new Date().toISOString() },
          },
        });
        if (n.parentId) {
          await ctx.prisma.edge.create({
            data: {
              projectId: input.projectId,
              sourceId: n.parentId,
              targetId: created_node.id,
              kind: 'PARENT_CHILD',
            },
          });
        } else if (!tree.rootId) {
          await ctx.prisma.tree.update({ where: { id: tree.id }, data: { rootId: created_node.id } });
          treeByKind.set(n.treeKind, { ...tree, rootId: created_node.id });
        }
        created.push(created_node);
      }
      return created;
    }),
});
