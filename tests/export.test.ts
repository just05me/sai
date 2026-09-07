import { describe, it, expect } from 'vitest';
import { exportMarkdown } from '@/lib/exporters/markdown';
import type { Node, Project, Tree } from '@prisma/client';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Тестовый проект',
    emoji: '🧪',
    description: 'Описание проекта',
    workspaceId: 'ws-1',
    settings: {},
    createdById: 'user-1',
    publicSlug: null,
    archivedAt: null,
    pinnedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    ...overrides,
  };
}

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'node-1',
    projectId: 'proj-1',
    treeId: 'tree-1',
    parentId: null,
    title: 'Тестовый узел',
    description: 'Описание узла',
    tags: [],
    status: 'IDEA',
    position: { x: 0, y: 0 },
    hypothesisStatus: 'NONE',
    healthScore: 0,
    origin: {},
    decisionLog: [],
    collapsed: false,
    assigneeId: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('Markdown Export', () => {
  it('экспортирует пустой проект с заголовком', () => {
    const project = makeProject();
    const trees: Tree[] = [
      { id: 't1', projectId: 'proj-1', kind: 'DEV', rootId: null, createdAt: new Date() },
    ];
    const nodes: Node[] = [];
    const result = exportMarkdown(project, trees, nodes, 'human', []);

    expect(result).toContain('Тестовый проект');
    expect(result).toContain('🧪');
  });

  it('экспортирует узлы, сгруппированные по деревьям (human)', () => {
    const project = makeProject();
    const trees: Tree[] = [
      { id: 't-dev', projectId: 'proj-1', kind: 'DEV', rootId: null, createdAt: new Date() },
      { id: 't-func', projectId: 'proj-1', kind: 'FUNC', rootId: null, createdAt: new Date() },
    ];
    const nodes: Node[] = [
      makeNode({ id: 'n1', treeId: 't-dev', title: 'Архитектура' }),
      makeNode({ id: 'n2', treeId: 't-dev', title: 'База данных' }),
      makeNode({ id: 'n3', treeId: 't-func', title: 'Авторизация' }),
    ];

    const result = exportMarkdown(project, trees, nodes, 'human', []);

    // Должен содержать названия деревьев и узлов (русские метки)
    expect(result).toContain('Разработка');
    expect(result).toContain('Функции');
    expect(result).toContain('Архитектура');
    expect(result).toContain('База данных');
    expect(result).toContain('Авторизация');
  });

  it('экспорт для AI (audience=ai) содержит структурированный промпт', () => {
    const project = makeProject();
    const trees: Tree[] = [
      { id: 't-dev', projectId: 'proj-1', kind: 'DEV', rootId: null, createdAt: new Date() },
    ];
    const nodes: Node[] = [
      makeNode({ id: 'n1', treeId: 't-dev', title: 'API Gateway', description: 'Точка входа' }),
    ];

    const result = exportMarkdown(project, trees, nodes, 'ai', []);

    expect(result).toContain('API Gateway');
    expect(result).toContain('Точка входа');
  });

  it('обрабатывает узлы без описания', () => {
    const project = makeProject();
    const trees: Tree[] = [
      { id: 't-dev', projectId: 'proj-1', kind: 'DEV', rootId: null, createdAt: new Date() },
    ];
    const nodes: Node[] = [
      makeNode({ id: 'n1', treeId: 't-dev', title: 'Без описания', description: null }),
    ];

    const result = exportMarkdown(project, trees, nodes, 'human', []);

    expect(result).toContain('Без описания');
  });

  it('не падает на пустых массивах', () => {
    const project = makeProject({ name: 'Пустой' });
    const result = exportMarkdown(project, [], [], 'human', []);

    expect(result).toContain('Пустой');
  });
});
