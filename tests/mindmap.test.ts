import { describe, it, expect } from 'vitest';
import { computeMindMapLayout } from '@/lib/layouts/mindmap';

describe('MindMap Layout (d3-hierarchy)', () => {
  it('возвращает пустую карту для пустого списка узлов', () => {
    const positions = computeMindMapLayout([], []);
    expect(positions.size).toBe(0);
  });

  it('размещает один узел', () => {
    const nodes = [{ id: '1', title: 'Root', parentId: null }];
    const positions = computeMindMapLayout(nodes, []);
    expect(positions.size).toBe(1);
    expect(positions.get('1')).toBeTruthy();
  });

  it('строит цепочку: родитель → ребёнок (x=глубина увеличивается)', () => {
    const nodes = [
      { id: '1', title: 'Parent', parentId: null },
      { id: '2', title: 'Child', parentId: '1' },
    ];
    const edges = [{ sourceId: '1', targetId: '2' }];
    const positions = computeMindMapLayout(nodes, edges);
    expect(positions.size).toBe(2);
    const p1 = positions.get('1')!;
    const p2 = positions.get('2')!;
    // Ребёнок должен быть глубже (x-координата больше)
    expect(p2.x).toBeGreaterThan(p1.x);
  });

  it('строит веер: дети на одном уровне глубины, разные по горизонтали', () => {
    const nodes = [
      { id: 'root', title: 'Root', parentId: null },
      { id: 'c1', title: 'Child 1', parentId: 'root' },
      { id: 'c2', title: 'Child 2', parentId: 'root' },
      { id: 'c3', title: 'Child 3', parentId: 'root' },
    ];
    const edges = [
      { sourceId: 'root', targetId: 'c1' },
      { sourceId: 'root', targetId: 'c2' },
      { sourceId: 'root', targetId: 'c3' },
    ];
    const positions = computeMindMapLayout(nodes, edges);
    expect(positions.size).toBe(4);
    // Все дети на одном уровне глубины (x)
    const x1 = positions.get('c1')?.x;
    const x2 = positions.get('c2')?.x;
    const x3 = positions.get('c3')?.x;
    expect(x1).toBe(x2);
    expect(x2).toBe(x3);
    // Но с разными y (горизонтальный разброс)
    const ys = [positions.get('c1')?.y, positions.get('c2')?.y, positions.get('c3')?.y]
      .filter((v): v is number => v !== undefined);
    expect(new Set(ys).size).toBe(3);
  });

  it('не падает на циклических ссылках', () => {
    const nodes = [
      { id: '1', title: 'A', parentId: '2' },
      { id: '2', title: 'B', parentId: '1' },
    ];
    const edges = [
      { sourceId: '1', targetId: '2' },
      { sourceId: '2', targetId: '1' },
    ];
    expect(() => computeMindMapLayout(nodes, edges)).not.toThrow();
  });

  it('обрабатывает несвязанные узлы как отдельные корни', () => {
    const nodes = [
      { id: 'a', title: 'A', parentId: null },
      { id: 'b', title: 'B', parentId: null },
      { id: 'c', title: 'C', parentId: null },
    ];
    const positions = computeMindMapLayout(nodes, []);
    // Все три — отдельные деревья, каждый с уникальными позициями
    expect(positions.size).toBe(3);
  });

  it('работает с узлами без parentId (определяем иерархию из edges)', () => {
    const nodes = [
      { id: '1', title: 'Root', parentId: null },
      { id: '2', title: 'Child', parentId: null },
    ];
    const edges = [{ sourceId: '1', targetId: '2' }];
    const positions = computeMindMapLayout(nodes, edges);
    expect(positions.size).toBe(2);
    const rootX = positions.get('1')?.x ?? 0;
    const childX = positions.get('2')?.x ?? 0;
    // Ребёнок глубже
    expect(childX).toBeGreaterThan(rootX);
  });
});
