import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.id) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, user: ctx.session.user } });
});

export const workspaceProcedure = protectedProcedure
  .use(async ({ ctx, next, input }) => {
    const wsId =
      (input as { workspaceId?: string } | undefined)?.workspaceId ??
      ctx.activeWorkspaceId;
    if (!wsId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'workspaceId required' });
    const member = await ctx.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: wsId, userId: ctx.user.id } },
    });
    if (!member) throw new TRPCError({ code: 'FORBIDDEN' });
    return next({ ctx: { ...ctx, workspaceId: wsId, role: member.role } });
  });

/**
 * Универсальные guards: гарантируют, что entity по id принадлежит ctx.workspaceId.
 * Защита от IDOR: workspaceProcedure проверяет членство в workspace, но не сверяет
 * сущность с этим workspace.
 */
export async function assertProjectInWorkspace(
  prisma: Context['prisma'],
  projectId: string,
  workspaceId: string,
): Promise<void> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!p || p.workspaceId !== workspaceId) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
}

export async function assertNodeInWorkspace(
  prisma: Context['prisma'],
  nodeId: string,
  workspaceId: string,
): Promise<{ projectId: string }> {
  const n = await prisma.node.findUnique({
    where: { id: nodeId },
    select: { projectId: true, project: { select: { workspaceId: true } } },
  });
  if (!n || n.project.workspaceId !== workspaceId) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
  return { projectId: n.projectId };
}

export async function assertEdgeInWorkspace(
  prisma: Context['prisma'],
  edgeId: string,
  workspaceId: string,
): Promise<void> {
  const e = await prisma.edge.findUnique({
    where: { id: edgeId },
    select: { project: { select: { workspaceId: true } } },
  });
  if (!e || e.project.workspaceId !== workspaceId) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
}
