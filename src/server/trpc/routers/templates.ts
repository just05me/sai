import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { TreeKind } from '@prisma/client';
import { publicProcedure, router, workspaceProcedure } from '../trpc';

const templatePayloadSchema = z.object({
  trees: z.array(
    z.object({
      kind: z.enum(['DEV', 'FUNC', 'BIZ']),
      nodes: z.array(
        z.object({
          title: z.string(),
          description: z.string().optional(),
          children: z
            .array(
              z.object({
                title: z.string(),
                description: z.string().optional(),
              }),
            )
            .optional(),
        }),
      ),
    }),
  ),
});

export const templatesRouter = router({
  list: publicProcedure
    .input(z.object({ category: z.string().optional(), q: z.string().optional() }).optional())
    .query(({ ctx, input }) =>
      ctx.prisma.template.findMany({
        where: {
          scope: 'PUBLIC',
          category: input?.category,
          OR: input?.q
            ? [
                { name: { contains: input.q, mode: 'insensitive' } },
                { description: { contains: input.q, mode: 'insensitive' } },
              ]
            : undefined,
        },
        orderBy: { rating: 'desc' },
        take: 60,
      }),
    ),

  fork: workspaceProcedure
    .input(z.object({ templateId: z.string(), workspaceId: z.string(), name: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const tpl = await ctx.prisma.template.findUniqueOrThrow({ where: { id: input.templateId } });
      // PERSONAL и WORKSPACE-шаблоны не должны утекать наружу.
      if (tpl.scope === 'WORKSPACE' && tpl.workspaceId !== ctx.workspaceId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      if (tpl.scope === 'PERSONAL' && tpl.authorId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      await ctx.prisma.template.update({
        where: { id: input.templateId },
        data: { forkCount: { increment: 1 } },
      });
      const project = await ctx.prisma.project.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: input.name ?? `${tpl.name} — копия`,
          description: tpl.description,
          createdById: ctx.user.id,
        },
      });
      const trees = Object.values(TreeKind);
      await ctx.prisma.tree.createMany({
        data: trees.map((kind) => ({ projectId: project.id, kind })),
      });

      // Разворачиваем payload в реальные узлы, если шаблон содержит данные.
      const parsed = templatePayloadSchema.safeParse(tpl.payload);
      if (parsed.success) {
        const dbTrees = await ctx.prisma.tree.findMany({ where: { projectId: project.id } });
        for (const tree of parsed.data.trees) {
          const dbTree = dbTrees.find((t) => t.kind === tree.kind);
          if (!dbTree) continue;
          for (const [i, n] of tree.nodes.entries()) {
            const root = await ctx.prisma.node.create({
              data: {
                projectId: project.id,
                treeId: dbTree.id,
                title: n.title,
                description: n.description,
                position: { x: i * 240, y: 0 },
                origin: { type: 'template', created_at: new Date().toISOString() },
              },
            });
            if (i === 0) {
              await ctx.prisma.tree.update({
                where: { id: dbTree.id },
                data: { rootId: root.id },
              });
            }
            for (const [j, c] of (n.children ?? []).entries()) {
              const child = await ctx.prisma.node.create({
                data: {
                  projectId: project.id,
                  treeId: dbTree.id,
                  parentId: root.id,
                  title: c.title,
                  description: c.description,
                  position: { x: i * 240 + (j - 1) * 180, y: 160 },
                  origin: { type: 'template', created_at: new Date().toISOString() },
                },
              });
              await ctx.prisma.edge.create({
                data: { projectId: project.id, sourceId: root.id, targetId: child.id, kind: 'PARENT_CHILD' },
              });
            }
          }
        }
      }
      return project;
    }),
});
