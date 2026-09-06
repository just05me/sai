import { z } from 'zod';
import { router, workspaceProcedure } from '../trpc';

export const searchRouter = router({
  text: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), q: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      // F-129: postgres-полнотекст. Используем ILIKE для простоты,
      // в продакшене заменить на FTS-индексы и GIN tsvector.
      const nodes = await ctx.prisma.node.findMany({
        where: {
          project: { workspaceId: input.workspaceId },
          deletedAt: null,
          OR: [
            { title: { contains: input.q, mode: 'insensitive' } },
            { description: { contains: input.q, mode: 'insensitive' } },
          ],
        },
        include: { project: { select: { id: true, name: true } } },
        take: 40,
      });
      return nodes;
    }),

  // F-130 semantic — заглушка под pgvector. Реальная реализация:
  //   1. На AiMemoryService.embed считаем embedding узла OpenAI text-embedding-3-small
  //   2. SQL: SELECT * FROM "Node" ORDER BY embedding <=> $vec LIMIT 20;
  semantic: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), q: z.string() }))
    .query(async () => []),
});
