/**
 * SSE streaming для Global Chat / Node Chat.
 * F-255 streaming, F-225 AI Context Memory подмешивается через AIMemoryService.
 */
import { streamText, convertToCoreMessages, tool } from 'ai';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { ProviderManager, ProviderError } from '@/server/services/provider-manager';
import { personaSystem, type PersonaId } from '@/server/ai/personas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  workspaceId: z.string(),
  projectId: z.string(),
  chatId: z.string().optional(),
  nodeId: z.string().optional(),
  activeTree: z.enum(['DEV', 'FUNC', 'BIZ']).optional(),
  persona: z.string().optional(),
  provider: z.enum(['OPENAI', 'ANTHROPIC', 'OPENROUTER', 'OLLAMA', 'CUSTOM', 'DEEPSEEK']).optional(),
  model: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const body = schema.safeParse(await req.json());
  if (!body.success) return Response.json(body.error.flatten(), { status: 400 });
  const { workspaceId, projectId, nodeId, activeTree, persona, provider: providerKind, model, messages } = body.data;

  // membership check
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!member) return new Response('Forbidden', { status: 403 });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!project || project.workspaceId !== workspaceId) {
    return new Response('Forbidden', { status: 403 });
  }

  // build provider
  let resolved;
  try {
    resolved = await ProviderManager.resolve({
      workspaceId,
      userId: session.user.id,
      provider: providerKind,
      model,
    });
  } catch (e) {
    if (e instanceof ProviderError && e.code === 'NO_KEY') {
      return Response.json({ error: 'NO_KEY' }, { status: 402 });
    }
    throw e;
  }

  // F-225 — добавляем decision log проекта в системный промпт.
  const projectContext = await prisma.node.findMany({
    where: { projectId, deletedAt: null },
    select: { title: true, description: true, tree: { select: { kind: true } }, decisionLog: true },
    take: 50,
  });
  const ctxString = projectContext
    .map((n) => `[${n.tree.kind}] ${n.title}${n.description ? ` — ${n.description.slice(0, 100)}` : ''}`)
    .join('\n');

  const treesWithCounts = await prisma.tree.findMany({
    where: { projectId },
    select: {
      kind: true,
      _count: { select: { nodes: { where: { deletedAt: null } } } },
    },
  });
  const nodeCounts = {
    total: treesWithCounts.reduce((s, t) => s + t._count.nodes, 0),
    DEV: treesWithCounts.find((t) => t.kind === 'DEV')?._count.nodes ?? 0,
    FUNC: treesWithCounts.find((t) => t.kind === 'FUNC')?._count.nodes ?? 0,
    BIZ: treesWithCounts.find((t) => t.kind === 'BIZ')?._count.nodes ?? 0,
  };

  // Если передан nodeId — грузим конкретный узел и добавляем в системный промпт.
  let nodeContext = '';
  if (nodeId) {
    const node = await prisma.node.findUnique({
      where: { id: nodeId },
      select: {
        projectId: true,
        title: true,
        description: true,
        tags: true,
        decisionLog: true,
        tree: { select: { kind: true } },
      },
    });
    if (!node || node.projectId !== projectId) {
      return new Response('Forbidden', { status: 403 });
    }
    const decisionLogText = node.decisionLog
      ? `\nDecision log: ${JSON.stringify(node.decisionLog)}`
      : '';
    nodeContext = `\n\n---\nCurrent node (FOCUS):\n[${node.tree.kind}] ${node.title}${node.description ? `\nDescription: ${node.description}` : ''}${node.tags.length ? `\nTags: ${node.tags.join(', ')}` : ''}${decisionLogText}`;
  }

  const system = `${personaSystem(persona as PersonaId | undefined)}

У тебя есть инструмент propose_tree — он ПРЕДЛАГАЕТ структуру дерева для холста (не записывает сразу).
Когда пользователь просит построить / сгенерировать / переделать / доделать дерево, структуру, карту,
план или иерархию узлов на канвасе — вызывай propose_tree, а не описывай дерево только текстом.
После вызова коротко поясни, что предложил; пользователь выберет — сохранить старое, заменить частично или переписать с нуля.

Поле suggestedMode:
- append — добавить к существующему (доделать, расширить)
- replace_subtree — заменить поддерево у replaceAtNodeId / parentNodeId / фокусного узла
- replace_tree — перестроить всё дерево DEV/FUNC/BIZ целиком
- rewrite_all — удалить все узлы проекта и построить заново (только если явно просят «с нуля» / «заново всё»)

Project context (last 50 nodes):
${ctxString}${nodeContext}`;

  // Узел дерева ограничен 3 уровнями вложенности — большинство провайдеров плохо
  // работают с рекурсивными JSON-схемами, поэтому глубину фиксируем явно.
  const leafSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
  });
  const midSchema = leafSchema.extend({
    children: z.array(leafSchema).max(8).optional(),
  });
  const rootSchema = leafSchema.extend({
    children: z.array(midSchema).max(8).optional(),
  });

  const treeToolParams = z.object({
    treeKind: z
      .enum(['DEV', 'FUNC', 'BIZ'])
      .optional()
      .describe('Дерево: DEV, FUNC или BIZ. По умолчанию — активное.'),
    suggestedMode: z
      .enum(['append', 'replace_subtree', 'replace_tree', 'rewrite_all'])
      .optional()
      .describe('Рекомендуемый режим: append / replace_subtree / replace_tree / rewrite_all'),
    parentNodeId: z
      .string()
      .optional()
      .describe('Прикрепить к существующему узлу (для append).'),
    replaceAtNodeId: z
      .string()
      .optional()
      .describe('Какое поддерево заменить (для replace_subtree).'),
    root: rootSchema.describe('Корневой узел дерева с вложенными children (до 3 уровней).'),
  });

  const executeTreeProposal = async ({
    treeKind,
    suggestedMode,
    parentNodeId,
    replaceAtNodeId,
    root,
  }: z.infer<typeof treeToolParams>) => {
    const kind = treeKind ?? activeTree ?? 'DEV';
    const total = 1 + (root.children?.reduce((s, c) => s + 1 + (c.children?.length ?? 0), 0) ?? 0);
    const existingInTargetTree = nodeCounts[kind];
    return {
      type: 'tree_proposal' as const,
      treeKind: kind,
      suggestedMode: suggestedMode ?? 'append',
      parentNodeId: parentNodeId ?? nodeId ?? null,
      replaceAtNodeId: replaceAtNodeId ?? parentNodeId ?? nodeId ?? null,
      root,
      nodeCount: total,
      existingNodes: nodeCounts,
      existingInTargetTree,
    };
  };

  const result = streamText({
    model: resolved.client(resolved.model),
    system,
    messages: convertToCoreMessages(messages as any),
    maxSteps: 4,
    abortSignal: req.signal,
    tools: {
      propose_tree: tool({
        description:
          'Предлагает дерево узлов для холста. Не записывает в БД — пользователь подтверждает режим применения.',
        parameters: treeToolParams,
        execute: executeTreeProposal,
      }),
      // Алиас — некоторые модели всё ещё вызывают build_tree.
      build_tree: tool({
        description: 'Алиас propose_tree — предлагает дерево для холста.',
        parameters: treeToolParams,
        execute: executeTreeProposal,
      }),
    },
  });

  return result.toDataStreamResponse({
    headers: { 'X-Sai-Provider': resolved.provider, 'X-Sai-Model': resolved.model },
    // По умолчанию SDK маскирует ошибку как «An error occurred» — раскрываем текст,
    // иначе при падении провайдера во время стрима в чате остаётся пустой ответ.
    getErrorMessage: (error) =>
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Ошибка AI',
  });
}
