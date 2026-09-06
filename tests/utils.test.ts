import { describe, it, expect } from 'vitest';
import { cn, TREE_META } from '@/lib/utils';

describe('Utility: cn', () => {
  it('объединяет классы через пробел', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('отбрасывает falsy значения', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b');
  });

  it('разрешает конфликты Tailwind через последний класс', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
  });

  it('работает с условными классами', () => {
    const active = true;
    const disabled = false;
    expect(cn('base', active && 'active', disabled && 'disabled')).toBe('base active');
  });

  it('возвращает пустую строку если все falsy', () => {
    expect(cn(false, undefined, null, '')).toBe('');
  });
});

describe('Utility: TREE_META', () => {
  it('имеет три дерева', () => {
    expect(Object.keys(TREE_META)).toHaveLength(3);
    expect(TREE_META.DEV).toBeDefined();
    expect(TREE_META.FUNC).toBeDefined();
    expect(TREE_META.BIZ).toBeDefined();
  });

  it('каждое дерево имеет label и color', () => {
    for (const [key, meta] of Object.entries(TREE_META)) {
      expect(meta.label).toBeTruthy();
      expect(meta.color).toBeTruthy();
      expect(key).toMatch(/^(DEV|FUNC|BIZ)$/);
    }
  });

  it('цвета уникальны для каждого дерева', () => {
    const colors = Object.values(TREE_META).map((m) => m.color);
    expect(new Set(colors).size).toBe(3);
  });
});
