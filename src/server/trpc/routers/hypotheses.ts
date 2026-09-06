import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  router,
  workspaceProcedure,
  assertProjectInWorkspace,
  assertNodeInWorkspace,
} from '../trpc';

export const hypothesesRouter = router({
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      return ctx.prisma.hypothesis.findMany({
        where: { projectId: input.projectId },
        include: { node: true },
        orderBy: { updatedAt: 'desc' },
      });
    }),

  upsert: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      projectId: z.string(),
      nodeId: z.string(),
      question: z.string().min(1),
      status: z.enum(['UNTESTED', 'TESTING', 'VALIDATED', 'INVALIDATED']),
      learnings: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      const node = await assertNodeInWorkspace(ctx.prisma, input.nodeId, ctx.workspaceId);
      if (node.projectId !== input.projectId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'node in another project' });
      }
      const hyp = await ctx.prisma.hypothesis.upsert({
        where: { nodeId: input.nodeId },
        create: {
          projectId: input.projectId,
          nodeId: input.nodeId,
          question: input.question,
          status: input.status,
          learnings: input.learnings,
        },
        update: {
          question: input.question,
          status: input.status,
          learnings: input.learnings,
        },
      });
      // F-225: фиксируем «что узнали» в decision log (Json-массив → read-modify-write,
      // т.к. Prisma `push` не работает для Json-колонок Postgres).
      if (input.learnings) {
        const cur = await ctx.prisma.node.findUniqueOrThrow({
          where: { id: input.nodeId },
          select: { decisionLog: true },
        });
        const log = Array.isArray(cur.decisionLog)
          ? (cur.decisionLog as unknown[])
          : [];
        log.push({
          summary: input.learnings,
          created_at: new Date().toISOString(),
          ai_model: null,
        });
        await ctx.prisma.node.update({
          where: { id: input.nodeId },
          data: { decisionLog: log as object },
        });
      }
      return hyp;
    }),
});
