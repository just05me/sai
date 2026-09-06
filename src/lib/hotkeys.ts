/**
 * Глобальный справочник хоткеев (см. ТЗ §5). Используется командной палитрой
 * и кастомизатором (Settings → Shortcuts, F-220).
 */
export interface HotkeyDef {
  id: string;
  combo: string;
  description: string;
  scope: 'global' | 'canvas' | 'node';
  defaultCombo: string;
}

export const HOTKEYS: HotkeyDef[] = [
  { id: 'cmd_palette', combo: 'mod+k', defaultCombo: 'mod+k', description: 'Command palette / Global Chat', scope: 'global' },
  { id: 'tree_dev', combo: '1', defaultCombo: '1', description: 'Дерево Разработка', scope: 'global' },
  { id: 'tree_func', combo: '2', defaultCombo: '2', description: 'Дерево Функции', scope: 'global' },
  { id: 'tree_biz', combo: '3', defaultCombo: '3', description: 'Дерево Бизнес', scope: 'global' },
  { id: 'fit', combo: 'f', defaultCombo: 'f', description: 'Подогнать к экрану / Focus', scope: 'canvas' },
  { id: 'reset_zoom', combo: '0', defaultCombo: '0', description: 'Сброс зума', scope: 'canvas' },
  { id: 'search', combo: '/', defaultCombo: '/', description: 'Поиск по узлам', scope: 'global' },
  { id: 'expand', combo: 'e', defaultCombo: 'e', description: 'Expand узла', scope: 'node' },
  { id: 'deepen', combo: 'd', defaultCombo: 'd', description: 'Deepen — открыть Node Chat', scope: 'node' },
  { id: 'refactor', combo: 'r', defaultCombo: 'r', description: 'Refactor предложение', scope: 'node' },
  { id: 'bridge', combo: 'b', defaultCombo: 'b', description: 'Bridge Suggest', scope: 'node' },
  { id: 'undo', combo: 'mod+z', defaultCombo: 'mod+z', description: 'Undo', scope: 'global' },
  { id: 'redo', combo: 'mod+shift+z', defaultCombo: 'mod+shift+z', description: 'Redo', scope: 'global' },
  { id: 'select_all', combo: 'mod+a', defaultCombo: 'mod+a', description: 'Выбрать все узлы', scope: 'canvas' },
  { id: 'escape', combo: 'esc', defaultCombo: 'esc', description: 'Снять выделение / Выйти из Focus', scope: 'global' },
  { id: 'help', combo: '?', defaultCombo: '?', description: 'Справка по хоткеям', scope: 'global' },
];
