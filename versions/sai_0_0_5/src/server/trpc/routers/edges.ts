import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  router,
  workspaceProcedure,
  assertProjectInWorkspace,
  assertEdgeInWorkspace,
} from '../trpc';

const edgeKindSchema = z.enum(['PARENT_CHILD', 'DEPENDS_ON', 'RELATES_TO', 'BRIDGE']);

export const edgesRouter = router({
  byProject: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      return ctx.prisma.edge.findMany({ where: { projectId: input.projectId } });
    }),

  create: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      projectId: z.string(),
      sourceId: z.string(),
      targetId: z.string(),
      kind: edgeKindSchema.default('RELATES_TO'),
      label: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      // Source/target тоже должны лежать в этом проекте.
      const ends = await ctx.prisma.node.findMany({
        where: { id: { in: [input.sourceId, input.targetId] } },
        select: { id: true, projectId: true },
      });
      if (ends.length !== 2 || ends.some((n) => n.projectId !== input.projectId)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'edge crosses projects' });
      }
      return ctx.prisma.edge.create({
        data: {
          projectId: input.projectId,
          sourceId: input.sourceId,
          targetId: input.targetId,
          kind: input.kind,
          label: input.label,
        },
      });
    }),

  delete: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertEdgeInWorkspace(ctx.prisma, input.id, ctx.workspaceId);
      return ctx.prisma.edge.delete({ where: { id: input.id } });
    }),
});
