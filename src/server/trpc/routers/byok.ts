import { z } from 'zod';
import { router, workspaceProcedure, protectedProcedure } from '../trpc';
import { deriveBYOKPassphrase } from '@/server/crypto';

const providerSchema = z.enum(['OPENAI', 'ANTHROPIC', 'OPENROUTER', 'OLLAMA', 'CUSTOM', 'DEEPSEEK']);

export const byokRouter = router({
  /**
   * Возвращает passphrase, которым клиент должен зашифровать ключ перед save().
   * Сервер выводит её детерминированно из BYOK_SERVER_SECRET + userId, поэтому
   * любые попытки клиента передать что-то иное приведут к OperationError на decrypt.
   */
  passphrase: protectedProcedure.query(({ ctx }) => ({
    passphrase: deriveBYOKPassphrase(ctx.user.id),
  })),

  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.byokKey.findMany({
        where: { workspaceId: input.workspaceId },
        select: {
          id: true,
          provider: true,
          label: true,
          baseUrl: true,
          defaultModel: true,
          isDefault: true,
          lastUsedAt: true,
          monthlyTokens: true,
          monthlyCostCent: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ),

  save: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      provider: providerSchema,
      label: z.string().min(1).max(80),
      baseUrl: z.string().optional(),
      defaultModel: z.string().optional(),
      isDefault: z.boolean().default(false),
      ciphertext: z.string(),
      iv: z.string(),
      salt: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.isDefault) {
        await ctx.prisma.byokKey.updateMany({
          where: { workspaceId: input.workspaceId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const decode = (b64: string) => Buffer.from(b64, 'base64');
      await ctx.prisma.byokKey.upsert({
        where: {
          workspaceId_provider_label: {
            workspaceId: input.workspaceId,
            provider: input.provider,
            label: input.label,
          },
        },
        create: {
          workspaceId: input.workspaceId,
          provider: input.provider,
          label: input.label,
          baseUrl: input.baseUrl,
          defaultModel: input.defaultModel,
          isDefault: input.isDefault,
          encryptedKey: decode(input.ciphertext),
          iv: decode(input.iv),
          salt: decode(input.salt),
        },
        update: {
          baseUrl: input.baseUrl,
          defaultModel: input.defaultModel,
          isDefault: input.isDefault,
          encryptedKey: decode(input.ciphertext),
          iv: decode(input.iv),
          salt: decode(input.salt),
        },
      });
      // Не возвращаем Bytes-поля (encryptedKey/iv/salt): superjson не умеет
      // сериализовать Buffer, и клиент падает с "Unable to transform response".
      return { ok: true as const };
    }),

  remove: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const key = await ctx.prisma.byokKey.findUnique({
        where: { id: input.id },
        select: { workspaceId: true },
      });
      if (!key || key.workspaceId !== ctx.workspaceId) {
        return { ok: false as const };
      }
      await ctx.prisma.byokKey.delete({ where: { id: input.id } });
      return { ok: true as const };
    }),
});
