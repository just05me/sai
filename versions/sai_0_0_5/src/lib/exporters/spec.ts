import type { Edge, Node, Project, Tree, TreeKind } from '@prisma/client';

export type ExportAudience = 'human' | 'ai';

const TREE_LABEL: Record<TreeKind, string> = {
  DEV: 'Разработка',
  FUNC: 'Функции',
  BIZ: 'Бизнес',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'черновик',
  ACTIVE: 'в работе',
  DONE: 'готово',
  ARCHIVED: 'архив',
};

/** Порядок секций в объединённом ТЗ (сначала «зачем», потом «что», потом «как»). */
const MERGE_ORDER: TreeKind[] = ['BIZ', 'FUNC', 'DEV'];

const MERGED_SECTION: Record<TreeKind, string> = {
  BIZ: 'Бизнес-цели и контекст',
  FUNC: 'Функциональные требования',
  DEV: 'Технические требования и архитектура',
};

export interface SpecBuildOptions {
  audience?: ExportAudience;
  edges?: Edge[];
}

/**
 * Единый источник истины для ТЗ.
 * human — документ с разделами по деревьям;
 * ai — объединённое классическое ТЗ из всех выбранных деревьев + промпт для исполнения.
 */
export function buildSpecMarkdown(
  project: Project,
  trees: Tree[],
  nodes: Node[],
  opts: SpecBuildOptions = {},
): string {
  const audience = opts.audience ?? 'human';
  return audience === 'ai'
    ? buildMergedForAi(project, trees, nodes, opts.edges ?? [])
    : buildForHuman(project, trees, nodes);
}

function buildForHuman(project: Project, trees: Tree[], nodes: Node[]): string {
  const lines: string[] = [];
  lines.push(`# ${project.emoji ? `${project.emoji} ` : ''}${project.name}`);
  if (project.description) lines.push('', `> ${project.description}`);

  for (const tree of trees) {
    const treeNodes = nodes.filter((n) => n.treeId === tree.id);
    if (!treeNodes.length) continue;
    lines.push('', `## ${TREE_LABEL[tree.kind]}`);
    appendTreeNodes(tree.rootId, treeNodes, lines, 'human');
  }

  lines.push('', '---', `*Сгенерировано Sai · ${new Date().toLocaleString('ru-RU')}*`);
  return lines.join('\n');
}

/**
 * Сливает выбранные деревья в одно классическое ТЗ без разделения «Дерево DEV / FUNC / BIZ».
 * Бизнес → функции → техника; меж-деревья связи — отдельным блоком.
 */
function buildMergedForAi(project: Project, trees: Tree[], nodes: Node[], edges: Edge[]): string {
  const lines: string[] = [];
  lines.push(
    'Ты — опытный инженер-исполнитель. Ниже — единое техническое задание проекта, ' +
      'собранное из всех областей продукта. Реализуй проект полностью по этому ТЗ. ' +
      'Если чего-то не хватает — задай уточняющие вопросы перед началом работы.',
  );
  lines.push('', '---', '', `# Техническое задание: ${project.name}`);

  if (project.description) {
    lines.push('', '## Назначение', '', project.description);
  }

  const treeByKind = new Map(trees.map((t) => [t.kind, t]));
  const nodeIdToKind = new Map<string, TreeKind>();
  for (const n of nodes) {
    const kind = trees.find((t) => t.id === n.treeId)?.kind;
    if (kind) nodeIdToKind.set(n.id, kind);
  }

  let reqCounter = 0;
  for (const kind of MERGE_ORDER) {
    const tree = treeByKind.get(kind);
    if (!tree) continue;
    const treeNodes = nodes.filter((n) => n.treeId === tree.id);
    if (!treeNodes.length) continue;

    lines.push('', `## ${MERGED_SECTION[kind]}`);
    reqCounter = appendMergedRequirements(tree.rootId, treeNodes, lines, reqCounter);
  }

  const bridges = edges.filter((e) => {
    const from = nodeIdToKind.get(e.sourceId);
    const to = nodeIdToKind.get(e.targetId);
    return from && to && from !== to;
  });

  if (bridges.length) {
    lines.push('', '## Связи между требованиями');
    for (const edge of bridges) {
      const fromNode = nodes.find((n) => n.id === edge.sourceId);
      const toNode = nodes.find((n) => n.id === edge.targetId);
      if (!fromNode || !toNode) continue;
      const label = edge.label ? ` — ${edge.label}` : '';
      lines.push(
        `- **${fromNode.title}** (${TREE_LABEL[nodeIdToKind.get(edge.sourceId)!]}) → **${toNode.title}** (${TREE_LABEL[nodeIdToKind.get(edge.targetId)!]})${label}`,
      );
    }
  }

  lines.push(
    '',
    '---',
    '',
    '## Инструкция для исполнения',
    '',
    '1. Сначала пойми бизнес-цели и ограничения.',
    '2. Реализуй функциональные требования в порядке приоритета.',
    '3. Выбери архитектуру и стек под технические требования.',
    '4. Учти все связи между требованиями из разных областей.',
    '5. Покрой ключевую логику тестами и опиши, как запустить проект локально.',
  );

  return lines.join('\n');
}

function appendTreeNodes(
  rootId: string | null,
  treeNodes: Node[],
  out: string[],
  mode: 'human' | 'merged',
  reqCounter = 0,
): number {
  const root = rootId ? treeNodes.find((n) => n.id === rootId) : null;
  if (root) {
    if (mode === 'human') appendHumanNode(root, 0, out);
    else reqCounter = appendMergedNode(root, out, reqCounter);
  }
  return walkNodes(rootId, treeNodes, mode === 'human' ? 0 : 1, out, mode, reqCounter);
}

function appendMergedRequirements(
  rootId: string | null,
  treeNodes: Node[],
  out: string[],
  reqCounter: number,
): number {
  return appendTreeNodes(rootId, treeNodes, out, 'merged', reqCounter);
}

function walkNodes(
  parentId: string | null,
  nodes: Node[],
  depth: number,
  out: string[],
  mode: 'human' | 'merged',
  reqCounter: number,
): number {
  const children = nodes.filter((n) => n.parentId === parentId);
  for (const node of children) {
    if (mode === 'human') {
      appendHumanNode(node, depth, out);
      walkNodes(node.id, nodes, depth + 1, out, mode, reqCounter);
    } else {
      reqCounter = appendMergedNode(node, out, reqCounter);
      reqCounter = walkNodes(node.id, nodes, depth + 1, out, mode, reqCounter);
    }
  }
  return reqCounter;
}

function appendHumanNode(node: Node, depth: number, out: string[]) {
  const heading = '#'.repeat(Math.min(depth + 3, 6));
  out.push('', `${heading} ${node.title}`);
  if (node.status && STATUS_LABEL[node.status]) {
    out.push('', `**Статус:** ${STATUS_LABEL[node.status]}`);
  }
  if (node.description) out.push('', node.description);
  if (node.tags.length) out.push('', node.tags.map((t) => `\`${t}\``).join(' '));
}

function appendMergedNode(node: Node, out: string[], reqCounter: number): number {
  reqCounter += 1;
  const id = `REQ-${String(reqCounter).padStart(3, '0')}`;
  const meta: string[] = [];
  if (node.status && STATUS_LABEL[node.status]) meta.push(STATUS_LABEL[node.status]);
  if (node.tags.length) meta.push(node.tags.join(', '));
  const suffix = meta.length ? ` _(${meta.join('; ')})_` : '';

  out.push('', `### ${id}. ${node.title}${suffix}`);
  if (node.description) out.push('', node.description);
  return reqCounter;
}

/** Грубая конвертация markdown → plain text для .txt экспорта. */
export function markdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^---$/gm, '─'.repeat(40))
    .trimEnd();
}
