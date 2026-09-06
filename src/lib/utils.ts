import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TREE_META = {
  DEV: { label: 'Разработка', emoji: '🛠', color: 'hsl(var(--tree-dev))' },
  FUNC: { label: 'Функции', emoji: '✨', color: 'hsl(var(--tree-func))' },
  BIZ: { label: 'Бизнес', emoji: '📈', color: 'hsl(var(--tree-biz))' },
} as const;

export type TreeKey = keyof typeof TREE_META;
