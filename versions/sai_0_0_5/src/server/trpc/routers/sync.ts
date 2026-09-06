import { z } from 'zod';
import { router, workspaceProcedure } from '../trpc';
import { SyncService } from '@/server/services/sync';

export const syncRouter = router({
  analyze: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), projectId: z.string() }))
    .query(async ({ input }) => {
      return SyncService.analyze(input.projectId);
    }),

  createBridge: workspaceProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        projectId: z.string(),
        sourceNodeId: z.string(),
        targetNodeId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return SyncService.createBridge(
        input.projectId,
        input.sourceNodeId,
        input.targetNodeId,
        ctx.session.user.id,
      );
    }),
});
