import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, workspaceProcedure, assertProjectInWorkspace } from '../trpc';

export const commentsRouter = router({
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), projectId: z.string(), nodeId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      return ctx.prisma.comment.findMany({
        where: { projectId: input.projectId, nodeId: input.nodeId ?? undefined },
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: 'asc' },
      });
    }),

  add: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      projectId: z.string(),
      nodeId: z.string().optional(),
      edgeId: z.string().optional(),
      parentId: z.string().optional(),
      body: z.string().min(1).max(4000),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      if (input.parentId) {
        const parent = await ctx.prisma.comment.findUnique({
          where: { id: input.parentId },
          select: { projectId: true },
        });
        if (!parent || parent.projectId !== input.projectId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'parent comment in another project' });
        }
      }
      return ctx.prisma.comment.create({
        data: {
          projectId: input.projectId,
          nodeId: input.nodeId,
          edgeId: input.edgeId,
          parentId: input.parentId,
          authorId: ctx.user.id,
          body: input.body,
        },
      });
    }),

  resolve: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const c = await ctx.prisma.comment.findUnique({
        where: { id: input.id },
        select: { project: { select: { workspaceId: true } } },
      });
      if (!c || c.project.workspaceId !== ctx.workspaceId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return ctx.prisma.comment.update({
        where: { id: input.id },
        data: { resolvedAt: new Date() },
      });
    }),
});
