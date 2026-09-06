import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, workspaceProcedure, assertProjectInWorkspace } from '../trpc';
import { ShareService } from '@/server/services/share';

export const shareRouter = router({
  create: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      projectId: z.string(),
      permission: z.enum(['VIEW', 'COMMENT', 'EDIT']).default('VIEW'),
      password: z.string().optional(),
      ttlDays: z.union([z.literal(7), z.literal(30), z.literal(-1)]).default(-1),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      return ShareService.create({
        projectId: input.projectId,
        permission: input.permission,
        password: input.password,
        ttlDays: input.ttlDays,
        createdById: ctx.user.id,
      });
    }),

  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      return ctx.prisma.shareLink.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  revoke: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.prisma.shareLink.findUnique({
        where: { id: input.id },
        select: { project: { select: { workspaceId: true } } },
      });
      if (!link || link.project.workspaceId !== ctx.workspaceId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return ctx.prisma.shareLink.delete({ where: { id: input.id } });
    }),
});
