/**
 * UsageTracker — отслеживание токенов, AI-запросов, лимитов плана.
 */
import { prisma } from '@/server/prisma';

const PLAN_LIMITS = {
  FREE: { projects: 5, nodesPerProject: 100 },
  PRO: { projects: Infinity, nodesPerProject: 1000 },
  TEAM: { projects: Infinity, nodesPerProject: Infinity },
  SELFHOST_PRO: { projects: Infinity, nodesPerProject: Infinity },
} as const;

export const UsageTracker = {
  limits: PLAN_LIMITS,

  async snapshot(workspaceId: string) {
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const projects = await prisma.project.count({
      where: { workspaceId, archivedAt: null },
    });
    const totalNodes = await prisma.node.count({
      where: { project: { workspaceId }, deletedAt: null },
    });
    const tokensUsed = await prisma.byokKey.aggregate({
      where: { workspaceId },
      _sum: { monthlyTokens: true, monthlyCostCent: true },
    });
    return {
      plan: ws.plan,
      projects,
      totalNodes,
      tokens: Number(tokensUsed._sum.monthlyTokens ?? 0n),
      costCent: tokensUsed._sum.monthlyCostCent ?? 0,
      limits: PLAN_LIMITS[ws.plan],
    };
  },
};
