import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router, workspaceProcedure } from '../trpc';

export const workspaceRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.workspaceMember.findMany({
      where: { userId: ctx.user.id },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    }),
  ),

  current: workspaceProcedure.query(({ ctx }) =>
    ctx.prisma.workspace.findUniqueOrThrow({
      where: { id: ctx.workspaceId },
      include: { members: { include: { user: true } }, billing: true },
    }),
  ),

  rename: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), name: z.string().min(1).max(80) }))
    .mutation(({ ctx, input }) => {
      if (ctx.role !== 'OWNER' && ctx.role !== 'ADMIN') throw new TRPCError({ code: 'FORBIDDEN' });
      return ctx.prisma.workspace.update({ where: { id: input.workspaceId }, data: { name: input.name } });
    }),

  invite: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      email: z.string().email(),
      role: z.enum(['ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER']).default('EDITOR'),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.role !== 'OWNER' && ctx.role !== 'ADMIN') throw new TRPCError({ code: 'FORBIDDEN' });
      const token = crypto.randomUUID();
      return ctx.prisma.workspaceInvite.create({
        data: {
          workspaceId: input.workspaceId,
          email: input.email,
          role: input.role,
          token,
          invitedBy: ctx.user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      });
    }),
});
