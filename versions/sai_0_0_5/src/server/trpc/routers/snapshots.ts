import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, workspaceProcedure, assertProjectInWorkspace } from '../trpc';
import { SnapshotService } from '@/server/services/snapshot';

async function assertSnapshotInWorkspace(
  prisma: typeof import('@/server/prisma').prisma,
  snapshotId: string,
  workspaceId: string,
) {
  const s = await prisma.snapshot.findUnique({
    where: { id: snapshotId },
    select: { project: { select: { workspaceId: true } } },
  });
  if (!s || s.project.workspaceId !== workspaceId) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
}

export const snapshotsRouter = router({
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      return ctx.prisma.snapshot.findMany({
        where: { projectId: input.projectId },
        select: {
          id: true,
          label: true,
          reason: true,
          hash: true,
          size: true,
          authorId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  create: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      projectId: z.string(),
      label: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      return SnapshotService.takeManual(input.projectId, input.label, ctx.user.id);
    }),

  diff: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), a: z.string(), b: z.string() }))
    .query(async ({ ctx, input }) => {
      await Promise.all([
        assertSnapshotInWorkspace(ctx.prisma, input.a, ctx.workspaceId),
        assertSnapshotInWorkspace(ctx.prisma, input.b, ctx.workspaceId),
      ]);
      return SnapshotService.diff(input.a, input.b);
    }),

  restore: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), snapshotId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertSnapshotInWorkspace(ctx.prisma, input.snapshotId, ctx.workspaceId);
      return SnapshotService.restoreAsBranch(input.snapshotId, ctx.user.id);
    }),
});
