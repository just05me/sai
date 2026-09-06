/**
 * AIMemoryService — Team AI Memory (RAG) на pgvector.
 *
 * F-225 (Pro+): decision log + контекст узлов накапливается; в AI-запросах подмешиваются
 * top-K по cosine similarity. F-311 (Team): расширяется на весь workspace.
 *
 * В скелете: только структура. Embedding-генерация через OpenAI выполняется лениво
 * в воркере. Поиск через raw SQL по vector(1536).
 */
import { prisma } from '@/server/prisma';

export const AIMemoryService = {
  async store(opts: {
    workspaceId: string;
    projectId?: string;
    source: string;
    content: string;
    embedding?: number[]; // length 1536
    meta?: object;
  }) {
    if (opts.embedding) {
      // raw SQL — Prisma не поддерживает vector type напрямую
      await prisma.$executeRawUnsafe(
        `INSERT INTO "AiMemory" (id, "workspaceId", "projectId", source, content, embedding, meta, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::vector, $6::jsonb, NOW())`,
        opts.workspaceId,
        opts.projectId ?? null,
        opts.source,
        opts.content,
        `[${opts.embedding.join(',')}]`,
        JSON.stringify(opts.meta ?? {}),
      );
    } else {
      await prisma.aiMemory.create({
        data: {
          workspaceId: opts.workspaceId,
          projectId: opts.projectId,
          source: opts.source,
          content: opts.content,
          meta: opts.meta as object,
        },
      });
    }
  },

  async retrieve(opts: { workspaceId: string; queryEmbedding: number[]; k?: number }) {
    const k = opts.k ?? 5;
    return prisma.$queryRawUnsafe<
      Array<{ id: string; content: string; source: string; similarity: number }>
    >(
      `SELECT id, content, source, 1 - (embedding <=> $1::vector) AS similarity
       FROM "AiMemory" WHERE "workspaceId" = $2 AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector LIMIT $3`,
      `[${opts.queryEmbedding.join(',')}]`,
      opts.workspaceId,
      k,
    );
  },
};
