import { z } from 'zod';
import { TreeKind } from '@prisma/client';
import { router, workspaceProcedure, assertProjectInWorkspace } from '../trpc';

const FREE_NODE_LIMIT = 100;

export const projectsRouter = router({
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), includeArchived: z.boolean().default(false) }))
    .query(({ ctx, input }) =>
      ctx.prisma.project.findMany({
        where: {
          workspaceId: input.workspaceId,
          archivedAt: input.includeArchived ? undefined : null,
        },
        orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      }),
    ),

  byId: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.id, ctx.workspaceId);
      return ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.id },
        include: { trees: true },
      });
    }),

  create: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      name: z.string().min(1).max(120),
      description: z.string().optional(),
      emoji: z.string().optional(),
      fromTemplateId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: input.name,
          description: input.description,
          emoji: input.emoji,
          createdById: ctx.user.id,
        },
      });
      // F-141 каждый проект сразу содержит ровно три дерева
      await ctx.prisma.tree.createMany({
        data: Object.values(TreeKind).map((kind) => ({
          projectId: project.id,
          kind,
        })),
      });
      return project;
    }),

  rename: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string(), name: z.string().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.id, ctx.workspaceId);
      return ctx.prisma.project.update({ where: { id: input.id }, data: { name: input.name } });
    }),

  archive: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.id, ctx.workspaceId);
      return ctx.prisma.project.update({ where: { id: input.id }, data: { archivedAt: new Date() } });
    }),

  restore: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.id, ctx.workspaceId);
      return ctx.prisma.project.update({ where: { id: input.id }, data: { archivedAt: null } });
    }),

  pin: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string(), pinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.id, ctx.workspaceId);
      return ctx.prisma.project.update({
        where: { id: input.id },
        data: { pinnedAt: input.pinned ? new Date() : null },
      });
    }),

  duplicate: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.id, ctx.workspaceId);
      const original = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.id },
        include: { nodes: { where: { deletedAt: null } }, edges: true, trees: true },
      });
      const copy = await ctx.prisma.project.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: `${original.name} (копия)`,
          description: original.description,
          emoji: original.emoji,
          createdById: ctx.user.id,
        },
      });
      const treeMap = new Map<string, string>();
      for (const t of original.trees) {
        const newTree = await ctx.prisma.tree.create({
          data: { projectId: copy.id, kind: t.kind },
        });
        treeMap.set(t.id, newTree.id);
      }

      // Топологический порядок: родители раньше детей, чтобы parentId уже был замапплен.
      const nodeMap = new Map<string, string>();
      const remaining = [...original.nodes];
      let safety = remaining.length * 2 + 1;
      while (remaining.length && safety-- > 0) {
        for (let i = remaining.length - 1; i >= 0; i--) {
          const n = remaining[i];
          if (n.parentId && !nodeMap.has(n.parentId)) continue;
          const newNode = await ctx.prisma.node.create({
            data: {
              projectId: copy.id,
              treeId: treeMap.get(n.treeId)!,
              parentId: n.parentId ? nodeMap.get(n.parentId)! : null,
              title: n.title,
              description: n.description,
              tags: n.tags,
              status: n.status,
              hypothesisStatus: n.hypothesisStatus,
              position: n.position as object,
              origin: n.origin as object,
              decisionLog: n.decisionLog as object,
            },
          });
          nodeMap.set(n.id, newNode.id);
          remaining.splice(i, 1);
        }
      }
      // Циклические родители (защита от поломки данных) — создаём как корни.
      for (const n of remaining) {
        const newNode = await ctx.prisma.node.create({
          data: {
            projectId: copy.id,
            treeId: treeMap.get(n.treeId)!,
            title: n.title,
            description: n.description,
            tags: n.tags,
            status: n.status,
            position: n.position as object,
            origin: n.origin as object,
          },
        });
        nodeMap.set(n.id, newNode.id);
      }

      // Восстанавливаем rootId у каждого дерева.
      for (const t of original.trees) {
        if (t.rootId && nodeMap.has(t.rootId)) {
          await ctx.prisma.tree.update({
            where: { id: treeMap.get(t.id)! },
            data: { rootId: nodeMap.get(t.rootId)! },
          });
        }
      }

      for (const e of original.edges) {
        const src = nodeMap.get(e.sourceId);
        const tgt = nodeMap.get(e.targetId);
        if (src && tgt) {
          await ctx.prisma.edge.create({
            data: { projectId: copy.id, sourceId: src, targetId: tgt, kind: e.kind, label: e.label },
          });
        }
      }
      return copy;
    }),

  usage: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.id, ctx.workspaceId);
      const nodes = await ctx.prisma.node.count({
        where: { projectId: input.id, deletedAt: null },
      });
      const ws = await ctx.prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } });
      const limit =
        ws.plan === 'FREE' ? FREE_NODE_LIMIT : ws.plan === 'PRO' ? 1000 : Infinity;
      return { nodes, limit, ratio: limit === Infinity ? 0 : nodes / limit };
    }),
});
