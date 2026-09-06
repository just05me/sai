import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, workspaceProcedure, assertProjectInWorkspace } from '../trpc';

const chatRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
const ROLE_TO_DB = {
  user: 'USER',
  assistant: 'ASSISTANT',
  system: 'SYSTEM',
  tool: 'TOOL',
} as const;

export const chatsRouter = router({
  list: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      const chats = await ctx.prisma.chat.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { messages: true } },
          // Первое сообщение пользователя используем как заголовок чата,
          // последнее — для сортировки/предпросмотра.
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            where: { role: 'USER' },
            select: { content: true },
          },
        },
      });
      return chats.map((c) => ({
        id: c.id,
        kind: c.kind,
        nodeId: c.nodeId,
        persona: c.persona,
        createdAt: c.createdAt,
        messageCount: c._count.messages,
        title: c.messages[0]?.content?.slice(0, 80) ?? null,
      }));
    }),

  messages: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      const chat = await ctx.prisma.chat.findUnique({
        where: { id: input.chatId },
        select: { project: { select: { workspaceId: true } } },
      });
      if (!chat || chat.project.workspaceId !== ctx.workspaceId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return ctx.prisma.chatMessage.findMany({
        where: { chatId: input.chatId },
        orderBy: { createdAt: 'asc' },
      });
    }),

  open: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      projectId: z.string(),
      kind: z.enum(['GLOBAL', 'NODE']),
      nodeId: z.string().optional(),
      persona: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInWorkspace(ctx.prisma, input.projectId, ctx.workspaceId);
      if (input.nodeId) {
        const node = await ctx.prisma.node.findUnique({
          where: { id: input.nodeId },
          select: { projectId: true },
        });
        if (!node || node.projectId !== input.projectId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'node in another project' });
        }
      }
      return ctx.prisma.chat.create({
        data: {
          projectId: input.projectId,
          kind: input.kind,
          nodeId: input.nodeId,
          persona: input.persona,
        },
      });
    }),

  /** Дописывает сообщения (обычно пару user→assistant) в существующий чат. */
  addMessages: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      chatId: z.string(),
      messages: z.array(z.object({
        role: chatRoleSchema,
        content: z.string(),
      })).min(1).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const chat = await ctx.prisma.chat.findUnique({
        where: { id: input.chatId },
        select: { project: { select: { workspaceId: true } } },
      });
      if (!chat || chat.project.workspaceId !== ctx.workspaceId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      await ctx.prisma.chatMessage.createMany({
        data: input.messages.map((m) => ({
          chatId: input.chatId,
          role: ROLE_TO_DB[m.role],
          content: m.content,
        })),
      });
      return { ok: true };
    }),

  /** Удаляет сообщение и всё, что после него (для edit/regenerate). */
  truncateAfter: workspaceProcedure
    .input(z.object({
      workspaceId: z.string(),
      chatId: z.string(),
      messageId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const anchor = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.messageId },
        select: { chatId: true, createdAt: true, chat: { select: { project: { select: { workspaceId: true } } } } },
      });
      if (!anchor || anchor.chatId !== input.chatId || anchor.chat.project.workspaceId !== ctx.workspaceId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      await ctx.prisma.chatMessage.deleteMany({
        where: { chatId: input.chatId, createdAt: { gt: anchor.createdAt } },
      });
      return { ok: true };
    }),

  /** Очищает все сообщения чата (редактирование первого сообщения). */
  clearMessages: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), chatId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const chat = await ctx.prisma.chat.findUnique({
        where: { id: input.chatId },
        select: { project: { select: { workspaceId: true } } },
      });
      if (!chat || chat.project.workspaceId !== ctx.workspaceId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      await ctx.prisma.chatMessage.deleteMany({ where: { chatId: input.chatId } });
      return { ok: true };
    }),

  delete: workspaceProcedure
    .input(z.object({ workspaceId: z.string(), chatId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const chat = await ctx.prisma.chat.findUnique({
        where: { id: input.chatId },
        select: { project: { select: { workspaceId: true } } },
      });
      if (!chat || chat.project.workspaceId !== ctx.workspaceId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      await ctx.prisma.chat.delete({ where: { id: input.chatId } });
      return { ok: true };
    }),
});
